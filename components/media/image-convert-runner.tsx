"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/tools/dropzone";
import { validateFiles } from "@/lib/files";
import { Loader2, Trash2, Download } from "lucide-react";
import type { MediaToolDefinition } from "@/lib/media/tools";
import { ToolPanel } from "@/components/tools/tool-ui";
import { FilePill, Field, RadioCards } from "@/components/tools/shared";

/**
 * A lightning-fast image conversion runner that uses HTML5 Canvas (and heic2any
 * for HEIC files) to instantly convert between PNG, JPG, and HEIC formats
 * entirely in the browser — no FFmpeg needed.
 */
export function ImageConvertRunner({ tool }: { tool: MediaToolDefinition }) {
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultName, setResultName] = useState("");
  const [opts, setOpts] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const control of tool.controls ?? []) initial[control.key] = control.default;
    return initial;
  });

  function add(files: File[]) {
    const { valid, error } = validateFiles(files, {
      accept: tool.accept,
      multiple: false,
      maxSizeMb: tool.maxSizeMb,
    });
    if (error) {
      setErr(error);
      return;
    }
    setErr(null);
    setFile(valid[0]);
  }

  async function convert() {
    if (!file) return;
    setLoading(true);
    setErr(null);

    try {
      // Determine target MIME and extension based on tool slug or control
      let targetMime: string;
      let targetExt: string;

      if (tool.slug === "png-to-jpg") {
        targetMime = "image/jpeg";
        targetExt = "jpg";
      } else if (tool.slug === "jpg-to-png") {
        targetMime = "image/png";
        targetExt = "png";
      } else if (tool.slug === "heic-to-jpg") {
        targetMime = "image/jpeg";
        targetExt = "jpg";
      } else if (tool.slug === "heic-to-png") {
        targetMime = "image/png";
        targetExt = "png";
      } else {
        targetMime = "image/jpeg";
        targetExt = "jpg";
      }

      let blob: Blob;

      if (tool.slug === "heic-to-jpg" || tool.slug === "heic-to-png") {
        // Use heic2any for HEIC decoding
        const heic2any = (await import("heic2any")).default;
        const result = await heic2any({
          blob: file,
          toType: targetMime,
          quality: targetMime === "image/jpeg" ? 0.95 : undefined,
        });
        blob = Array.isArray(result) ? result[0] : result;
      } else {
        // Standard Canvas-based conversion for PNG <-> JPG
        blob = await canvasConvert(file, targetMime);
      }

      const baseName = file.name.replace(/\.[^/.]+$/, "");
      const outName = `${baseName}.${targetExt}`;
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      setResultName(outName);
    } catch (e: any) {
      console.error("Image conversion failed:", e);
      setErr("Conversion failed. The file may be corrupted or unsupported.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setFile(null);
    setErr(null);
    setResultUrl(null);
    setResultName("");
  }

  function download() {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = resultName;
    a.click();
  }

  return (
    <ToolPanel>
      <div className="flex items-center justify-between p-6">
        <div>
          <h2 className="text-xl font-semibold leading-none tracking-tight">{tool.h1}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{tool.heroSubtitle}</p>
        </div>
      </div>

      <div className="border-t border-border bg-muted/30 p-6">
        {/* Step 1: Drop zone */}
        {!file && (
          <div className="space-y-4">
            {err && <div className="text-sm font-medium text-destructive">{err}</div>}
            <Dropzone
              onFiles={add}
              multiple={false}
              accept={tool.accept}
              acceptLabel={tool.acceptLabel}
            />
          </div>
        )}

        {/* Step 2: File selected, show controls and convert button */}
        {file && !resultUrl && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <FilePill name={file.name} size={file.size} onRemove={reset} />
              <Button variant="outline" size="sm" onClick={reset}>
                <Trash2 className="mr-2 size-4" />
                Clear
              </Button>
            </div>

            {err && <div className="text-sm font-medium text-destructive">{err}</div>}

            {/* Optional controls (e.g., output format for HEIC) */}
            {(tool.controls ?? []).map((ctrl) => (
              <Field key={ctrl.key} label={ctrl.label}>
                <RadioCards
                  name={ctrl.key}
                  value={opts[ctrl.key] ?? ctrl.default}
                  onChange={(v) => setOpts((p) => ({ ...p, [ctrl.key]: v }))}
                  options={ctrl.options}
                  columns={ctrl.columns}
                />
              </Field>
            ))}

            <Button onClick={convert} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  {tool.processingLabel}
                </>
              ) : (
                tool.action
              )}
            </Button>
          </div>
        )}

        {/* Step 3: Result ready */}
        {resultUrl && (
          <div className="space-y-6">
            <div className="flex min-h-[150px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-background p-6 text-center">
              <div className="rounded-full bg-green-500/10 p-3 text-green-500 mb-3">
                <Download className="size-6" />
              </div>
              <h3 className="text-sm font-semibold">Conversion Complete</h3>
              <p className="text-sm text-muted-foreground mt-1">{resultName} is ready to download.</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={reset} className="flex-1">
                Convert Another
              </Button>
              <Button onClick={download} className="flex-1">
                <Download className="mr-2 size-4" />
                {tool.downloadLabel}
              </Button>
            </div>
          </div>
        )}
      </div>
    </ToolPanel>
  );
}

/** Convert a standard image file (PNG, JPG, WebP) to a target MIME via Canvas. */
function canvasConvert(file: File, targetMime: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("Canvas context unavailable"));
        return;
      }

      // For JPG: fill white background first (since JPG has no transparency)
      if (targetMime === "image/jpeg") {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob returned null"));
        },
        targetMime,
        targetMime === "image/jpeg" ? 0.95 : undefined,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}
