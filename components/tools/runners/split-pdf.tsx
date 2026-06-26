"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/tools/dropzone";
import { useProcessor } from "@/components/tools/use-processor";
import { ToolFrame } from "@/components/tools/tool-frame";
import { FilePill, Field, TextInput, RadioCards, type RunnerProps } from "@/components/tools/shared";
import { validateFiles, baseName } from "@/lib/files";
import { getPageCount } from "@/lib/pdf/core";
import { splitPdf, type SplitOptions } from "@/lib/pdf/split";

export function SplitPdf({ tool }: RunnerProps) {
  const proc = useProcessor(tool.slug);
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [mode, setMode] = useState<SplitOptions["mode"]>("ranges");
  const [ranges, setRanges] = useState("");
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
    setRanges("");
    setMode("ranges");
    setErr(null);
    proc.reset();
  }

  const canRun = !!file && (mode === "each" || ranges.trim().length > 0);

  return (
    <ToolFrame
      proc={proc}
      onReset={reset}
      processingLabel="Splitting your PDF…"
      downloadLabel="Download files"
      zipName={file ? `${baseName(file.name)}-split.zip` : undefined}
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

          <Field label="How would you like to split?">
            <RadioCards
              name="Split mode"
              columns={2}
              value={mode}
              onChange={setMode}
              options={[
                { value: "ranges", label: "By page ranges", description: "e.g. 1-3, 5, 8-10" },
                { value: "each", label: "Every page", description: "One PDF per page" },
              ]}
            />
          </Field>

          {mode === "ranges" ? (
            <Field label="Page ranges" htmlFor="ranges" hint="Each range becomes its own PDF file.">
              <TextInput
                id="ranges"
                placeholder="1-3, 5, 8-10"
                value={ranges}
                onChange={(e) => setRanges(e.target.value)}
                inputMode="numeric"
              />
            </Field>
          ) : null}

          {err ? <p className="text-sm text-destructive">{err}</p> : null}

          <div className="flex justify-end">
            <Button
              size="lg"
              disabled={!canRun}
              onClick={() => proc.run((report) => splitPdf([file], { mode, ranges }, { onProgress: report }))}
            >
              Split PDF
            </Button>
          </div>
        </div>
      )}
    </ToolFrame>
  );
}
