"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/tools/dropzone";
import { useProcessor } from "@/components/tools/use-processor";
import { ToolFrame } from "@/components/tools/tool-frame";
import { FilePill, Field, TextInput, RadioCards, type RunnerProps } from "@/components/tools/shared";
import { validateFiles, baseName } from "@/lib/files";
import { getPageCount, parsePageList } from "@/lib/pdf/core";
import { runPdfOp } from "@/lib/pdf/worker/pdf-worker-client";

type Quality = "screen" | "print";
const PRESETS: Record<Quality, { scale: number; quality: number }> = {
  screen: { scale: 1.5, quality: 0.82 },
  print: { scale: 2.5, quality: 0.92 },
};

export function PdfToJpg({ tool }: RunnerProps) {
  const proc = useProcessor(tool.slug);
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [quality, setQuality] = useState<Quality>("screen");
  const [pagesInput, setPagesInput] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function add(incoming: File[]) {
    const { valid, error } = validateFiles(incoming, { accept: tool.accept, multiple: false });
    if (error) return setErr(error);
    setErr(null);
    const f = valid[0];
    setFile(f);
    setPageCount(null);
    try {
      setPageCount(await getPageCount(f));
    } catch {
      setErr("Couldn't read this PDF. It may be corrupted or password-protected.");
      setFile(null);
    }
  }

  function reset() {
    setFile(null);
    setPageCount(null);
    setPagesInput("");
    setQuality("screen");
    setErr(null);
    proc.reset();
  }

  return (
    <ToolFrame
      proc={proc}
      onReset={reset}
      processingLabel="Converting pages to images…"
      downloadLabel="Download images"
      zipName={file ? `${baseName(file.name)}-images.zip` : undefined}
    >
      {!file ? (
        <>
          <Dropzone accept={tool.accept} acceptLabel={tool.acceptLabel} multiple={false} onFiles={add} />
          {err ? <p className="text-sm text-destructive">{err}</p> : null}
        </>
      ) : (
        <div className="space-y-4">
          <FilePill name={file.name} size={file.size} onRemove={reset} />
          {pageCount ? <p className="text-xs text-muted-foreground">This PDF has {pageCount} pages.</p> : null}

          <Field label="Image quality">
            <RadioCards
              name="Image quality"
              columns={2}
              value={quality}
              onChange={setQuality}
              options={[
                { value: "screen", label: "Standard", description: "Smaller, web-ready" },
                { value: "print", label: "High", description: "Sharp, for printing" },
              ]}
            />
          </Field>

          <Field label="Pages (optional)" htmlFor="pages" hint="Leave blank to convert every page. e.g. 1-3, 5">
            <TextInput
              id="pages"
              placeholder="All pages"
              value={pagesInput}
              onChange={(e) => setPagesInput(e.target.value)}
              inputMode="numeric"
            />
          </Field>

          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={() =>
                proc.run((report) => {
                  const pages =
                    pagesInput.trim() && pageCount ? parsePageList(pagesInput, pageCount) : undefined;
                  return runPdfOp("pdf-to-images", [file], { ...PRESETS[quality], pages }, report);
                })
              }
            >
              Convert to JPG
            </Button>
          </div>
        </div>
      )}
    </ToolFrame>
  );
}
