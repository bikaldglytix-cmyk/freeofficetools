"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/tools/dropzone";
import { useProcessor } from "@/components/tools/use-processor";
import { ToolFrame } from "@/components/tools/tool-frame";
import { FilePill, Field, TextInput, type RunnerProps } from "@/components/tools/shared";
import { validateFiles } from "@/lib/files";
import { runPdfOp } from "@/lib/pdf/worker/pdf-worker-client";
import { renderFirstPagePreview, type FirstPagePreview } from "@/lib/pdf/watermark-preview";

interface WatermarkSettings {
  text: string;
  fontSize: number;
  opacity: number;
  rotation: number;
  color: string;
}

function RangeRow({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--color-primary)]"
        aria-label={label}
      />
    </div>
  );
}

/**
 * Live preview of the watermark over page 1. The page is rendered once; the
 * watermark is a canvas overlay redrawn on every settings change, using the same
 * centering / rotation math as `watermarkPdf` so what you see matches the output.
 */
function WatermarkPreview({ file, settings }: { file: File; settings: WatermarkSettings }) {
  const [page, setPage] = useState<FirstPagePreview | null>(null);
  const [error, setError] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Render page 1 once per file.
  useEffect(() => {
    // Synchronizing with pdf.js (an external system); clearing the previous
    // page synchronously when the file changes is intentional, so the disable
    // below is scoped and deliberate (mirrors use-thumbnails.ts).
    /* eslint-disable react-hooks/set-state-in-effect */
    let cancelled = false;
    let urlToRevoke: string | null = null;
    setPage(null);
    setError(false);
    /* eslint-enable react-hooks/set-state-in-effect */
    renderFirstPagePreview(file)
      .then((p) => {
        if (cancelled) {
          URL.revokeObjectURL(p.url);
          return;
        }
        urlToRevoke = p.url;
        setPage(p);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
    };
  }, [file]);

  // Redraw the watermark overlay whenever the page or any setting changes, and
  // on resize so it stays aligned with the responsive page image.
  const { text, fontSize, opacity, rotation, color } = settings;
  useEffect(() => {
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box || !page) return;

    const draw = () => {
      const rect = box.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      const label = text.trim();
      if (!label) return;
      // Canvas pixels per PDF point — scales the point-based font size to match.
      const scale = w / page.pageWidth;
      ctx.save();
      // pdf-lib centers the text's baseline-midpoint at the page center and
      // rotates counter-clockwise (y-up). On screen (y-down) that's a negative
      // rotation about the same center point.
      ctx.translate(w / 2, h / 2);
      ctx.rotate((-rotation * Math.PI) / 180);
      ctx.font = `bold ${fontSize * scale}px Helvetica, Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = color;
      ctx.globalAlpha = Math.min(Math.max(opacity, 0.02), 1);
      ctx.fillText(label, 0, 0);
      ctx.restore();
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(box);
    return () => ro.disconnect();
  }, [page, text, fontSize, opacity, rotation, color]);

  return (
    <div className="lg:sticky lg:top-4">
      <p className="mb-2 text-sm font-medium text-foreground">Preview</p>
      {error ? (
        <div className="flex aspect-[1/1.3] items-center justify-center rounded-lg border border-border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
          Couldn&apos;t render a preview, but your watermark will still be applied.
        </div>
      ) : !page ? (
        <div
          className="flex aspect-[1/1.3] items-center justify-center rounded-lg border border-border bg-muted/30"
          aria-live="polite"
        >
          <span className="size-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
        </div>
      ) : (
        <>
          <div
            ref={boxRef}
            className="relative mx-auto overflow-hidden rounded-lg border border-border bg-white shadow-sm"
            style={{ aspectRatio: `${page.pageWidth} / ${page.pageHeight}` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- client-rendered object URL */}
            <img src={page.url} alt="" className="absolute inset-0 h-full w-full object-contain" />
            <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Page 1 preview
            {page.numPages > 1 ? ` · watermark applied to all ${page.numPages} pages` : ""}
          </p>
        </>
      )}
    </div>
  );
}

export function WatermarkPdf({ tool }: RunnerProps) {
  const proc = useProcessor(tool.slug);
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState("CONFIDENTIAL");
  const [fontSize, setFontSize] = useState(48);
  const [opacity, setOpacity] = useState(0.25);
  const [rotation, setRotation] = useState(45);
  const [color, setColor] = useState("#1e293b");

  function add(incoming: File[]) {
    const { valid, error } = validateFiles(incoming, { accept: tool.accept, multiple: false });
    if (error) return setErr(error);
    setErr(null);
    setFile(valid[0]);
  }

  function reset() {
    setFile(null);
    setErr(null);
    proc.reset();
  }

  return (
    <ToolFrame
      proc={proc}
      onReset={reset}
      processingLabel="Adding your watermark…"
      downloadLabel="Download watermarked PDF"
    >
      {!file ? (
        <>
          <Dropzone accept={tool.accept} acceptLabel={tool.acceptLabel} multiple={false} onFiles={add} />
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
        </>
      ) : (
        <div className="space-y-4">
          <FilePill name={file.name} size={file.size} onRemove={reset} />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
            {/* Preview first on mobile so it's visible without scrolling past controls. */}
            <div className="order-1 lg:order-2">
              <WatermarkPreview file={file} settings={{ text, fontSize, opacity, rotation, color }} />
            </div>

            <div className="order-2 space-y-4 lg:order-1">
              <Field label="Watermark text" htmlFor="wm-text">
                <TextInput
                  id="wm-text"
                  value={text}
                  maxLength={60}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="e.g. CONFIDENTIAL"
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <RangeRow label="Size" value={fontSize} min={12} max={120} step={2} onChange={setFontSize} />
                <RangeRow
                  label="Opacity"
                  value={Math.round(opacity * 100)}
                  min={5}
                  max={100}
                  step={5}
                  suffix="%"
                  onChange={(v) => setOpacity(v / 100)}
                />
                <RangeRow label="Rotation" value={rotation} min={0} max={90} step={5} suffix="°" onChange={setRotation} />
                <Field label="Color" htmlFor="wm-color">
                  <input
                    id="wm-color"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-10 w-full cursor-pointer rounded-lg border border-input bg-card p-1"
                    aria-label="Watermark color"
                  />
                </Field>
              </div>

              <div className="flex justify-end">
                <Button
                  size="lg"
                  disabled={!text.trim()}
                  onClick={() =>
                    proc.run((report) =>
                      runPdfOp("watermark", [file], { text, fontSize, opacity, color, rotation }, report),
                    )
                  }
                >
                  Add watermark
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ToolFrame>
  );
}
