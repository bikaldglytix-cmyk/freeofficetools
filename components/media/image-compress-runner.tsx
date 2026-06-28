"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/tools/dropzone";
import { useProcessor } from "@/components/tools/use-processor";
import { ToolFrame } from "@/components/tools/tool-frame";
import { FilePill, Field, RadioCards } from "@/components/tools/shared";
import { validateFiles, formatBytes, baseName } from "@/lib/files";
import type { MediaToolDefinition } from "@/lib/media/tools";
import { Input } from "@/components/ui/input";

type Mode = "quality" | "target";
type QualityLevel = "low" | "medium" | "high";

/**
 * Hit a target size by trying the largest dimension scale that fits, and within
 * each scale binary-searching for the highest quality under the limit. Prefers
 * detail (largest fitting scale); falls back to the smallest output it can make
 * if even a heavily downscaled version can't reach the target.
 */
async function compressImageToTarget(
  blobAt: (scaleFactor: number, q: number) => Promise<Blob>,
  targetBytes: number,
  report: (p: number) => void,
): Promise<Blob> {
  const scales = [1, 0.85, 0.7, 0.55, 0.45, 0.35, 0.25];
  let smallest: Blob | null = null;
  for (let s = 0; s < scales.length; s++) {
    report(0.5 + (s / scales.length) * 0.4);
    let lo = 0.1;
    let hi = 0.95;
    let fit: Blob | null = null;
    for (let i = 0; i < 6; i++) {
      const q = (lo + hi) / 2;
      const blob = await blobAt(scales[s], q);
      if (!smallest || blob.size < smallest.size) smallest = blob;
      if (blob.size <= targetBytes) {
        fit = blob;
        lo = q; // room to spare — push quality up
      } else {
        hi = q;
      }
    }
    if (fit) return fit; // largest scale that meets the target = most detail kept
  }
  return smallest!; // target unreachable; hand back the smallest we could make
}

export function ImageCompressRunner({ tool }: { tool: MediaToolDefinition }) {
  const proc = useProcessor(tool.slug);
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("quality");
  const [quality, setQuality] = useState<QualityLevel>("medium");
  const [targetMb, setTargetMb] = useState<string>("1.5");

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

  function reset() {
    setFile(null);
    setErr(null);
    proc.reset();
  }

  async function runCompression(report: (p: number) => void) {
    if (!file) throw new Error("No file selected.");
    
    // 1. Decode HEIC if necessary
    let imgFile = file;
    if (file.name.toLowerCase().endsWith(".heic") || file.name.toLowerCase().endsWith(".heif")) {
      report(0.1);
      const heic2any = (await import("heic2any")).default;
      const result = await heic2any({ blob: file, toType: "image/jpeg" });
      imgFile = new File([Array.isArray(result) ? result[0] : result], file.name.replace(/\.heic$/i, ".jpg"), {
        type: "image/jpeg",
      });
    }

    report(0.3);

    // 2. Load into Image
    const imgUrl = URL.createObjectURL(imgFile);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = imgUrl;
    });

    URL.revokeObjectURL(imgUrl);

    // Output format: keep PNG/WebP as WebP (lossy + alpha), everything else JPEG.
    const outMime = (imgFile.type === "image/png" || imgFile.type === "image/webp") ? "image/webp" : "image/jpeg";
    const outExt = outMime === "image/webp" ? ".webp" : ".jpg";
    const outName = baseName(imgFile.name) + "-compressed" + outExt;

    report(0.5);

    // Encode the image scaled by `scaleFactor`, at quality `q`. Downscaling
    // dimensions (not just quality) is what lets small targets actually be hit.
    const blobAt = (scaleFactor: number, q: number): Promise<Blob> => {
      const w = Math.max(1, Math.round(img.width * scaleFactor));
      const h = Math.max(1, Math.round(img.height * scaleFactor));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      return new Promise((resolve, reject) =>
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Canvas export failed"))), outMime, q),
      );
    };

    let finalBlob: Blob;
    if (mode === "quality") {
      const qValue = quality === "high" ? 0.9 : quality === "medium" ? 0.7 : 0.4;
      finalBlob = await blobAt(1, qValue);
      report(0.9);
    } else {
      const targetBytes = parseFloat(targetMb) * 1024 * 1024;
      if (!Number.isFinite(targetBytes) || targetBytes <= 0) throw new Error("Enter a target size larger than 0 MB.");
      finalBlob = await compressImageToTarget(blobAt, targetBytes, report);
      report(0.9);
    }

    report(1);

    return {
      outputs: [{ name: outName, blob: finalBlob }],
      meta: {
        inputSize: file.size,
        outputSize: finalBlob.size,
      },
    };
  }

  const meta = proc.result?.meta as { inputSize?: number; outputSize?: number } | undefined;
  const summary =
    meta && typeof meta.inputSize === "number" && typeof meta.outputSize === "number"
      ? `${formatBytes(meta.inputSize)} → ${formatBytes(meta.outputSize)}`
      : undefined;

  return (
    <ToolFrame
      proc={proc}
      onReset={reset}
      processingLabel={tool.processingLabel}
      downloadLabel={tool.downloadLabel}
      resultSummary={summary}
    >
      {!file ? (
        <>
          <Dropzone accept={tool.accept} acceptLabel={tool.acceptLabel} multiple={false} onFiles={add} />
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
        </>
      ) : (
        <div className="space-y-6">
          <FilePill name={file.name} size={file.size} onRemove={reset} />

          <Field label="Compression Mode">
            <RadioCards
              name="Compression Mode"
              columns={2}
              value={mode}
              onChange={setMode}
              options={[
                { value: "quality", label: "Fixed Quality", description: "Choose a standard preset" },
                { value: "target", label: "Target Size", description: "Compress to a specific file size limit" },
              ]}
            />
          </Field>

          {mode === "quality" ? (
            <Field label="Quality Level">
              <RadioCards
                name="Quality Level"
                columns={3}
                value={quality}
                onChange={setQuality}
                options={[
                  { value: "high", label: "High", description: "Larger file" },
                  { value: "medium", label: "Medium", description: "Balanced" },
                  { value: "low", label: "Low", description: "Smallest file" },
                ]}
              />
            </Field>
          ) : (
            <Field label="Target File Size (MB)" hint="The compressor will attempt to hit just under this limit.">
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

          <div className="flex justify-end pt-4">
            <Button size="lg" onClick={() => proc.run(runCompression)}>
              {tool.action}
            </Button>
          </div>
        </div>
      )}
    </ToolFrame>
  );
}
