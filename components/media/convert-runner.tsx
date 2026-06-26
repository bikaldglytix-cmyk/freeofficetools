"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/tools/dropzone";
import { useProcessor } from "@/components/tools/use-processor";
import { ToolFrame } from "@/components/tools/tool-frame";
import { FilePill, Field, RadioCards } from "@/components/tools/shared";
import { validateFiles, formatBytes } from "@/lib/files";
import { track, ToolEvents } from "@/lib/analytics";
import { processMediaFile, type MediaOptions } from "@/lib/media/engine";
import type { MediaToolDefinition } from "@/lib/media/tools";

/**
 * One runner drives every "upload → choose options → convert → download" media
 * tool. The controls come from the tool definition, so adding a tool needs no
 * new UI code — just data. Shares the exact state machine, progress, success
 * and error screens used by the PDF tools.
 */
export function ConvertRunner({ tool }: { tool: MediaToolDefinition }) {
  const proc = useProcessor(tool.slug);
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
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
    track(ToolEvents.fileAdded, { tool: tool.slug });
  }

  function reset() {
    setFile(null);
    setErr(null);
    proc.reset();
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
        <Dropzone accept={tool.accept} acceptLabel={tool.acceptLabel} multiple={false} onFiles={add} />
      ) : (
        <div className="space-y-5">
          <FilePill name={file.name} size={file.size} onRemove={reset} />

          {(tool.controls ?? []).map((control) => (
            <Field key={control.key} label={control.label}>
              <RadioCards
                name={control.label}
                value={opts[control.key] ?? control.default}
                columns={control.columns ?? 3}
                options={control.options}
                onChange={(value) => setOpts((prev) => ({ ...prev, [control.key]: value }))}
              />
            </Field>
          ))}

          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={() =>
                proc.run((report) =>
                  processMediaFile(tool.engine, [file], opts as MediaOptions, { onProgress: report }),
                )
              }
            >
              {tool.action}
            </Button>
          </div>
        </div>
      )}

      {err ? <p className="text-sm text-destructive">{err}</p> : null}
    </ToolFrame>
  );
}
