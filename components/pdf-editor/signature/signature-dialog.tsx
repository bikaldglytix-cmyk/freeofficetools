"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import { Check, Pen, Type as TypeIcon, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** What the dialog hands back; the caller places it on the page. */
export type SignatureSpec =
  | { mode: "typed"; text: string; fontFamily: string; color: string }
  | { mode: "image"; src: string };

type Tab = "type" | "draw" | "upload";

const FONTS = [
  { label: "Signature", value: "'Brush Script MT', 'Segoe Script', 'Bradley Hand', cursive" },
  { label: "Handwritten", value: "'Comic Sans MS', 'Segoe Print', cursive" },
  { label: "Formal", value: "Georgia, 'Times New Roman', serif" },
];

const TABS: Array<{ id: Tab; label: string; icon: typeof Pen }> = [
  { id: "type", label: "Type", icon: TypeIcon },
  { id: "draw", label: "Draw", icon: Pen },
  { id: "upload", label: "Upload", icon: Upload },
];

/**
 * A self-contained, accessible signature creator that replaces the old
 * `window.prompt`. The user types, draws, or uploads a signature; on confirm the
 * caller drops it on the page (once) and returns to the select tool, so it is
 * never re-stamped on every subsequent click.
 *
 * Mounted only while open (by the caller), so each appearance starts fresh — no
 * reset effect needed.
 */
export function SignatureDialog({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (spec: SignatureSpec) => void;
}) {
  const [tab, setTab] = useState<Tab>("type");
  const [text, setText] = useState("");
  const [font, setFont] = useState(FONTS[0].value);
  const [color, setColor] = useState("#0b1f4d");
  const [uploadSrc, setUploadSrc] = useState<string | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  // Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const canvasPoint = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  };
  const onCanvasDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = canvasPoint(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const onCanvasMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = canvasPoint(e);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = "#0b1f4d";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    if (!hasDrawn) setHasDrawn(true);
  };
  const onCanvasUp = () => {
    drawing.current = false;
  };
  const clearCanvas = () => {
    const c = canvasRef.current;
    if (c) c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    setHasDrawn(false);
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setUploadSrc(String(reader.result));
    reader.readAsDataURL(file);
  };

  const canConfirm = tab === "type" ? text.trim().length > 0 : tab === "draw" ? hasDrawn : Boolean(uploadSrc);

  const confirm = () => {
    if (tab === "type" && text.trim()) {
      onConfirm({ mode: "typed", text: text.trim(), fontFamily: font, color });
    } else if (tab === "draw" && hasDrawn && canvasRef.current) {
      onConfirm({ mode: "image", src: canvasRef.current.toDataURL("image/png") });
    } else if (tab === "upload" && uploadSrc) {
      onConfirm({ mode: "image", src: uploadSrc });
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Add signature"
      onPointerDown={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-xl"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Add your signature</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mb-3 flex items-center gap-0.5 rounded-lg bg-muted/60 p-0.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-pressed={tab === t.id}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                tab === t.id ? "bg-card text-primary shadow-sm ring-1 ring-primary/30" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="size-3.5" /> {t.label}
            </button>
          ))}
        </div>

        {tab === "type" ? (
          <div className="space-y-2">
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirm();
              }}
              placeholder="Type your name"
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
            />
            <div className="flex items-center gap-2">
              <select
                aria-label="Signature font"
                value={font}
                onChange={(e) => setFont(e.target.value)}
                className="h-8 flex-1 rounded-md border border-border bg-background px-1 text-xs text-foreground"
              >
                {FONTS.map((f) => (
                  <option key={f.label} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              <input
                type="color"
                aria-label="Signature color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-8 w-8 rounded-md border border-border bg-background"
              />
            </div>
            <div
              className="flex h-24 items-center justify-center rounded-md border border-dashed border-border bg-background"
              style={{ fontFamily: font, color, fontSize: 34 }}
            >
              {text.trim() || <span className="text-sm text-muted-foreground" style={{ fontFamily: "inherit" }}>Preview</span>}
            </div>
          </div>
        ) : null}

        {tab === "draw" ? (
          <div className="space-y-2">
            <canvas
              ref={canvasRef}
              width={440}
              height={170}
              onPointerDown={onCanvasDown}
              onPointerMove={onCanvasMove}
              onPointerUp={onCanvasUp}
              className="h-[170px] w-full touch-none rounded-md border border-dashed border-border bg-background"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Draw your signature above</span>
              <button type="button" onClick={clearCanvas} className="font-medium text-foreground hover:underline">
                Clear
              </button>
            </div>
          </div>
        ) : null}

        {tab === "upload" ? (
          <div className="space-y-2">
            <label className="flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-background text-sm text-muted-foreground hover:border-primary/50">
              {uploadSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={uploadSrc} alt="Signature preview" className="max-h-32 max-w-full object-contain" />
              ) : (
                <>
                  <Upload className="size-6" />
                  <span>Click to choose an image (PNG/JPG)</span>
                </>
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </label>
          </div>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!canConfirm}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-40"
          >
            <Check className="size-3.5" /> Add signature
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
