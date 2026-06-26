"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/tools/dropzone";
import { useProcessor } from "@/components/tools/use-processor";
import { ToolFrame } from "@/components/tools/tool-frame";
import { FilePill, Field, TextInput, type RunnerProps } from "@/components/tools/shared";
import { validateFiles, baseName } from "@/lib/files";
import { watermarkPdf } from "@/lib/pdf/watermark";

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
                  watermarkPdf([file], { text, fontSize, opacity, color, rotation }, { onProgress: report }),
                )
              }
            >
              Add watermark
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">File: {baseName(file.name)}</p>
        </div>
      )}
    </ToolFrame>
  );
}
