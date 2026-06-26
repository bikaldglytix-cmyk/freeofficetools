# Office conversion backend

A small, stateless LibreOffice-headless service that powers the Office tools
(`/word-to-pdf`, `/pdf-to-word`, `/excel-to-pdf`, `/pdf-to-excel`,
`/powerpoint-to-pdf`, `/pdf-to-powerpoint`). The Next.js app talks to it through
`app/api/office/convert/route.ts`, so the **frontend URL never changes** when
this backend moves from Render to a VPS.

Files are written to a temp dir and **deleted immediately** after each response —
nothing is ever stored.

## API

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| `GET` | `/health` | — | `{ ok: true }` |
| `POST` | `/convert` | multipart: `engine`, `file` | converted file bytes + `X-Filename` header |

`engine` is one of: `word-to-pdf`, `excel-to-pdf`, `powerpoint-to-pdf`,
`pdf-to-word`, `pdf-to-excel`, `pdf-to-powerpoint`.

### Environment

| Var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8080` | Listen port |
| `CONVERT_TOKEN` | — | If set, `/convert` requires `Authorization: Bearer <token>` |
| `MAX_FILE_MB` | `100` | Upload size limit |
| `ALLOWED_ORIGIN` | — | If set, enables CORS for that origin (direct browser uploads) |
| `CONVERT_TIMEOUT_MS` | `120000` | Per-conversion timeout |
| `SOFFICE_BIN` | `soffice` | Path to the LibreOffice binary |

## Run locally (Docker)

```bash
docker build -t office-converter services/office-converter
docker run -p 8080:8080 -e CONVERT_TOKEN=dev-secret office-converter

# smoke test
curl http://localhost:8080/health
curl -F engine=word-to-pdf -F file=@sample.docx \
     -H "Authorization: Bearer dev-secret" \
     http://localhost:8080/convert -o out.pdf
```

## Deploy on Render (free tier OK)

1. Push this repo to GitHub.
2. Render → **New → Blueprint**, select the repo. `render.yaml` provisions a
   Docker web service from `services/office-converter`, generates a
   `CONVERT_TOKEN`, and exposes a URL like
   `https://office-converter-xxxx.onrender.com`.
   (Or **New → Web Service → Docker**, root dir `services/office-converter`.)
3. Copy the generated **service URL** and **CONVERT_TOKEN** (Render → service →
   Environment).

### Activate it in the Next.js app

Set these env vars on the frontend (Vercel project settings → Environment
Variables) and redeploy:

```
OFFICE_BACKEND_URL=https://office-converter-xxxx.onrender.com
OFFICE_BACKEND_TOKEN=<the CONVERT_TOKEN value>
NEXT_PUBLIC_OFFICE_CONVERT_ENABLED=1
```

The Office tools flip from the "connecting soon" panel to the live upload →
convert → download flow automatically — no code or URL changes.

In this **proxy mode** the client caps uploads at **4 MB** to stay under the host's
request-body limit (see below), and shows that limit in the UI so users get an
instant "file too large" message instead of a failed request (HTTP 413).

### Larger files (direct-to-backend, bypasses the host limit)

To accept files up to the backend's own `MAX_FILE_MB`, have the browser upload
straight to the backend instead of through the Next API route. Set on the backend
`ALLOWED_ORIGIN=https://your-site.com`, and on the frontend:

```
NEXT_PUBLIC_OFFICE_CONVERT_ENABLED=1
NEXT_PUBLIC_OFFICE_BACKEND_URL=https://office-converter-xxxx.onrender.com
# optional: align the client cap with the backend's MAX_FILE_MB (defaults to the tool's limit in direct mode)
NEXT_PUBLIC_OFFICE_MAX_UPLOAD_MB=100
```

`NEXT_PUBLIC_OFFICE_MAX_UPLOAD_MB` also works in proxy mode to override the 4 MB
default (e.g. on a VPS host with a higher body limit).

## Notes & limits

- **Vercel request-body limit (~4.5 MB on Hobby).** Conversions proxy through
  the Next API route, so on Vercel Hobby large uploads can be rejected. Most
  Office docs are well under this. For large files, either deploy the Next app
  on a VPS (no such limit — the documented migration path) or set
  `ALLOWED_ORIGIN` here and switch `convertDocument()` to POST directly to this
  backend (CORS is already supported).
- **Free Render plan sleeps** after ~15 min idle; the first request then pays a
  cold start (plus LibreOffice's first-run). Use the `starter` plan for
  always-on, lower-latency conversions.
- **Memory.** LibreOffice needs headroom; 512 MB handles typical documents.
  Very large/complex files may need a larger instance.
- **Fidelity / supported directions.** `*-to-pdf` (Office→PDF) is high fidelity
  and fully supported. **`pdf-to-*` (PDF→Office) does NOT work with LibreOffice
  headless** — a PDF imports into Draw, which has no `.docx`/`.xlsx`/`.pptx`
  export path, so `--convert-to docx file.pdf` fails (HTTP 502) for every PDF.
  The three reverse tools are therefore gated off in the app
  (`isEngineReady()` in `lib/office/convert.ts`) and shown as "coming soon".
  To enable PDF→Word, add a dedicated engine such as `pdf2docx` (Python) to this
  service, branch on `engine` in `/convert`, then set
  `NEXT_PUBLIC_OFFICE_REVERSE_ENABLED=1` on the frontend.
