"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/tools/dropzone";
import { useProcessor } from "@/components/tools/use-processor";
import { ToolFrame } from "@/components/tools/tool-frame";
import { FilePill, Field, RadioCards, type RunnerProps } from "@/components/tools/shared";
import { validateFiles, baseName, formatBytes } from "@/lib/files";
import { compressPdf } from "@/lib/pdf/compress";

type Level = "low" | "recommended" | "strong";

const PRESETS: Record<Level, { scale: number; quality: number }> = {
  low: { scale: 2.0, quality: 0.85 },
  recommended: { scale: 1.4, quality: 0.7 },
  strong: { scale: 1.0, quality: 0.5 },
};

export function CompressPdf({ tool }: RunnerProps) {
  const proc = useProcessor(tool.slug);
  const [file, setFile] = useState<File | null>(null);
  const [level, setLevel] = useState<Level>("recommended");
  const [err, setErr] = useState<string | null>(null);

  function add(incoming: File[]) {
    const { valid, error } = validateFiles(incoming, { accept: tool.accept, multiple: false });
    if (error) return setErr(error);
    setErr(null);
    setFile(valid[0]);
  }

  function reset() {
    setFile(null);
    setLevel("recommended");
    setErr(null);
    proc.reset();
  }

  const meta = proc.result?.meta as
    | { originalSize?: number; newSize?: number; savedPercent?: number; alreadyOptimized?: boolean }
    | undefined;

  const summary = meta
    ? meta.alreadyOptimized
      ? "This PDF was already well optimized, so we kept the original file."
      : `Reduced by ${meta.savedPercent}% — from ${formatBytes(meta.originalSize ?? 0)} to ${formatBytes(meta.newSize ?? 0)}.`
    : undefined;

  return (
    <ToolFrame
      proc={proc}
      onReset={reset}
      processingLabel="Compressing your PDF…"
      downloadLabel="Download compressed PDF"
      resultSummary={summary}
    >
      {!file ? (
        <>
          <Dropzone accept={tool.accept} acceptLabel={tool.acceptLabel} multiple={false} onFiles={add} />
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
        </>
      ) : (
        <div className="space-y-4">
          <FilePill name={file.name} size={file.size} onRemove={reset} />

          <Field label="Compression level" hint="Compression optimizes images. Scanned PDFs shrink the most.">
            <RadioCards
              name="Compression level"
              columns={3}
              value={level}
              onChange={setLevel}
              options={[
                { value: "low", label: "Less", description: "Best quality" },
                { value: "recommended", label: "Recommended", description: "Balanced" },
                { value: "strong", label: "Strong", description: "Smallest file" },
              ]}
            />
          </Field>

          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={() =>
                proc.run((report) => compressPdf([file], PRESETS[level], { onProgress: report }))
              }
            >
              Compress PDF
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            File: {baseName(file.name)} · {formatBytes(file.size)}
          </p>
        </div>
      )}
    </ToolFrame>
  );
}
