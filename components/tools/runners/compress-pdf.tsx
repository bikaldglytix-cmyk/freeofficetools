"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dropzone } from "@/components/tools/dropzone";
import { useProcessor } from "@/components/tools/use-processor";
import { ToolFrame } from "@/components/tools/tool-frame";
import { FilePill, Field, RadioCards, type RunnerProps } from "@/components/tools/shared";
import { validateFiles, baseName, formatBytes } from "@/lib/files";
import { runPdfOp } from "@/lib/pdf/worker/pdf-worker-client";

type Level = "low" | "recommended" | "strong";
type Mode = "level" | "target";

const PRESETS: Record<Level, { maxDim: number; quality: number }> = {
  low: { maxDim: 2400, quality: 0.82 },
  recommended: { maxDim: 1600, quality: 0.65 },
  strong: { maxDim: 1100, quality: 0.5 },
};

export function CompressPdf({ tool }: RunnerProps) {
  const proc = useProcessor(tool.slug);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<Mode>("level");
  const [level, setLevel] = useState<Level>("recommended");
  const [targetMb, setTargetMb] = useState<string>("1");
  const [err, setErr] = useState<string | null>(null);

  function add(incoming: File[]) {
    const { valid, error } = validateFiles(incoming, { accept: tool.accept, multiple: false });
    if (error) return setErr(error);
    setErr(null);
    setFile(valid[0]);
  }

  function reset() {
    setFile(null);
    setMode("level");
    setLevel("recommended");
    setTargetMb("1");
    setErr(null);
    proc.reset();
  }

  const meta = proc.result?.meta as
    | {
        originalSize?: number;
        newSize?: number;
        savedPercent?: number;
        alreadyOptimized?: boolean;
        targetBytes?: number;
        targetReached?: boolean;
        lossless?: boolean;
      }
    | undefined;

  const summary = (() => {
    if (!meta) return undefined;
    const from = formatBytes(meta.originalSize ?? 0);
    const to = formatBytes(meta.newSize ?? 0);
    if (meta.alreadyOptimized) {
      return meta.targetBytes
        ? `Couldn't get below ${formatBytes(meta.targetBytes)} without growing the file — this PDF is already as small as we can make it (${from}).`
        : `This PDF is already about as small as it gets, so we kept the original (${from}).`;
    }
    const base = `Reduced by ${meta.savedPercent}% — from ${from} to ${to}${meta.lossless ? " (no quality loss)" : ""}.`;
    if (meta.targetBytes && meta.targetReached === false) {
      return `${base} That's the smallest we could reach; it's still above your ${formatBytes(meta.targetBytes)} target.`;
    }
    if (meta.targetBytes) return `${base} Under your ${formatBytes(meta.targetBytes)} target.`;
    return base;
  })();

  function run() {
    if (!file) return;
    if (mode === "target") {
      const mb = parseFloat(targetMb);
      if (!Number.isFinite(mb) || mb <= 0) return setErr("Enter a target size larger than 0 MB.");
      setErr(null);
      const targetBytes = Math.round(mb * 1024 * 1024);
      proc.run((report) => runPdfOp("compress", [file], { ...PRESETS.recommended, targetBytes }, report));
    } else {
      proc.run((report) => runPdfOp("compress", [file], PRESETS[level], report));
    }
  }

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

          <Field label="How should we compress?">
            <RadioCards
              name="Compression mode"
              columns={2}
              value={mode}
              onChange={setMode}
              options={[
                { value: "level", label: "By quality", description: "Pick a strength" },
                { value: "target", label: "To a size", description: "Set a file-size limit" },
              ]}
            />
          </Field>

          {mode === "level" ? (
            <Field label="Compression level" hint="Recompresses images only — your text stays selectable and searchable. Image-heavy and scanned PDFs shrink the most.">


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
          ) : (
            <Field
              label="Target file size (MB)"
              hint="We get as close below this as we can without making the file bigger than the original."
            >
              <Input
                type="number"
                step="0.1"
                min="0.1"
                value={targetMb}
                onChange={(e) => setTargetMb(e.target.value)}
                className="max-w-[200px]"
              />
            </Field>
          )}

          <div className="flex justify-end">
            <Button size="lg" onClick={run}>
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
