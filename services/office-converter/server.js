"use strict";

/**
 * FreeOfficeTools — document conversion backend.
 *
 * A tiny, stateless HTTP service that shells out to LibreOffice headless to
 * convert documents. It implements the contract the Next.js app expects
 * (POST /convert with `engine` + `file`, see app/api/office/convert/route.ts):
 * the same backend works whether the Next app proxies to it or a browser
 * calls it directly (CORS).
 *
 * Privacy: every file is written to a temp dir and deleted immediately after
 * the response — nothing is ever stored.
 */

const express = require("express");
const multer = require("multer");
const { execFile } = require("node:child_process");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.PORT || 8080);
const TOKEN = (process.env.CONVERT_TOKEN || "").trim();
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const MAX_MB = Number(process.env.MAX_FILE_MB || 100);
const SOFFICE = process.env.SOFFICE_BIN || "soffice";
const TIMEOUT_MS = Number(process.env.CONVERT_TIMEOUT_MS || 120000);

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

// engine -> { out: output extension, filter: LibreOffice --convert-to value, mime }
const ENGINES = {
  "word-to-pdf": { out: "pdf", filter: "pdf", mime: "application/pdf" },
  "excel-to-pdf": { out: "pdf", filter: "pdf:calc_pdf_Export", mime: "application/pdf" },
  "powerpoint-to-pdf": { out: "pdf", filter: "pdf:impress_pdf_Export", mime: "application/pdf" },
  "pdf-to-word": { out: "docx", filter: "docx:MS Word 2007 XML", mime: DOCX_MIME },
  "pdf-to-excel": { out: "xlsx", filter: "xlsx:Calc MS Excel 2007 XML", mime: XLSX_MIME },
  "pdf-to-powerpoint": { out: "pptx", filter: "pptx:Impress MS PowerPoint 2007 XML", mime: PPTX_MIME },
};

const sanitize = (s) => String(s).replace(/[^\w.-]+/g, "_").slice(0, 100);

const storage = multer.diskStorage({
  destination: os.tmpdir(),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase().replace(/[^.a-z0-9]/g, "");
    cb(null, `src-${crypto.randomUUID()}${ext || ".bin"}`);
  },
});
const upload = multer({ storage, limits: { fileSize: MAX_MB * 1024 * 1024 } });

const app = express();
app.disable("x-powered-by");

// A request is from one of our own sites when its Origin is allow-listed.
function originAllowed(req) {
  const origin = req.get("origin");
  return Boolean(origin) && ALLOWED_ORIGINS.includes(origin);
}

// CORS so a browser can call the backend directly (bypassing a proxy's
// request-size limits). Enabled per-request when the Origin is allow-listed.
app.use((req, res, next) => {
  if (originAllowed(req)) {
    res.setHeader("Access-Control-Allow-Origin", req.get("origin"));
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Expose-Headers", "X-Filename");
    res.setHeader("Access-Control-Max-Age", "86400");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  return next();
});

app.get("/health", (_req, res) => res.json({ ok: true, service: "office-converter" }));

function runSoffice(filter, inputPath, outdir) {
  return new Promise((resolve, reject) => {
    const profile = path.join(outdir, "profile");
    const args = [
      "--headless",
      "--norestore",
      "--nolockcheck",
      "--nodefault",
      "--nologo",
      "--nofirststartwizard",
      `-env:UserInstallation=file://${profile}`,
      "--convert-to",
      filter,
      "--outdir",
      outdir,
      inputPath,
    ];
    execFile(SOFFICE, args, { timeout: TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 }, (err, _stdout, stderr) => {
      if (err) return reject(new Error(`soffice failed: ${stderr || err.message}`));
      return resolve();
    });
  });
}

app.post("/convert", upload.single("file"), async (req, res) => {
  const cleanup = [];
  const done = async () => {
    await Promise.allSettled(cleanup.map((p) => fsp.rm(p, { recursive: true, force: true })));
  };

  try {
    // Authorize via the shared token (server-to-server proxy) OR an allow-listed
    // Origin (direct browser upload from our own site).
    const tokenOk = Boolean(TOKEN) && req.get("authorization") === `Bearer ${TOKEN}`;
    const protectionConfigured = Boolean(TOKEN) || ALLOWED_ORIGINS.length > 0;
    if (protectionConfigured && !tokenOk && !originAllowed(req)) {
      if (req.file) cleanup.push(req.file.path);
      await done();
      return res.status(401).json({ error: "Unauthorized" });
    }

    const cfg = ENGINES[req.body.engine];
    if (!cfg) {
      if (req.file) cleanup.push(req.file.path);
      await done();
      return res.status(400).json({ error: "Unknown or missing engine" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const inputPath = req.file.path;
    cleanup.push(inputPath);
    const outdir = await fsp.mkdtemp(path.join(os.tmpdir(), "conv-"));
    cleanup.push(outdir);

    await runSoffice(cfg.filter, inputPath, outdir);

    const outName = `${path.basename(inputPath, path.extname(inputPath))}.${cfg.out}`;
    const data = await fsp.readFile(path.join(outdir, outName));
    if (!data.length) throw new Error("empty output");

    const base = sanitize(path.basename(req.file.originalname, path.extname(req.file.originalname))) || "converted";
    res.setHeader("Content-Type", cfg.mime);
    res.setHeader("X-Filename", `${base}.${cfg.out}`);
    res.setHeader("Cache-Control", "no-store");
    res.send(data);
  } catch (err) {
    console.error("convert error:", err.message);
    res.status(502).json({ error: "Conversion failed" });
  } finally {
    await done();
  }
});

// Multer / generic error handler (e.g. file too large).
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    const tooBig = err.code === "LIMIT_FILE_SIZE";
    return res.status(tooBig ? 413 : 400).json({ error: tooBig ? `File exceeds ${MAX_MB} MB` : err.message });
  }
  console.error("server error:", err);
  return res.status(500).json({ error: "Server error" });
});

app.listen(PORT, () => console.log(`office-converter listening on :${PORT} (max ${MAX_MB}MB)`));
