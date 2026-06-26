"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/tools/dropzone";
import { useProcessor } from "@/components/tools/use-processor";
import { ToolFrame } from "@/components/tools/tool-frame";
import { FilePill, Field, TextInput } from "@/components/tools/shared";
import { validateFiles } from "@/lib/files";
import { track, ToolEvents } from "@/lib/analytics";
import { processMediaFile } from "@/lib/media/engine";
import type { MediaToolDefinition } from "@/lib/media/tools";

/** Parse "90", "1:30" or "1:02:03" into seconds; null if it isn't a valid time. */
function parseTime(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  if (/^\d+(\.\d+)?$/.test(v)) return parseFloat(v);
  const parts = v.split(":");
  if (parts.length < 2 || parts.length > 3) return null;
  if (!parts.every((p) => /^\d+(\.\d+)?$/.test(p))) return null;
  return parts.reduce((acc, p) => acc * 60 + parseFloat(p), 0);
}

export function TrimRunner({ tool }: { tool: MediaToolDefinition }) {
  const proc = useProcessor(tool.slug);
  const [file, setFile] = useState<File | null>(null);
  const [start, setStart] = useState("0");
  const [end, setEnd] = useState("");
  const [err, setErr] = useState<string | null>(null);

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
    setStart("0");
    setEnd("");
    setErr(null);
    proc.reset();
  }

  function run() {
    const startSec = parseTime(start) ?? 0;
    const endSec = parseTime(end);
    if (end.trim() && endSec === null) {
      setErr("Enter the end time as seconds (90) or a timestamp (1:30).");
      return;
    }
    if (endSec !== null && endSec <= startSec) {
      setErr("The end time must be after the start time.");
      return;
    }
    setErr(null);
    if (!file) return;
    proc.run((report) =>
      processMediaFile(tool.engine, [file], { start, end }, { onProgress: report }),
    );
  }

  return (
    <ToolFrame
      proc={proc}
      onReset={reset}
      processingLabel={tool.processingLabel}
      downloadLabel={tool.downloadLabel}
    >
      {!file ? (
        <Dropzone accept={tool.accept} acceptLabel={tool.acceptLabel} multiple={false} onFiles={add} />
      ) : (
        <div className="space-y-5">
          <FilePill name={file.name} size={file.size} onRemove={reset} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start time" htmlFor="trim-start" hint="Seconds (45) or MM:SS (1:30)">
              <TextInput
                id="trim-start"
                inputMode="numeric"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                placeholder="0"
              />
            </Field>
            <Field label="End time" htmlFor="trim-end" hint="Leave blank to trim to the end">
              <TextInput
                id="trim-end"
                inputMode="numeric"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                placeholder="e.g. 1:30"
              />
            </Field>
          </div>

          <div className="flex justify-end">
            <Button size="lg" onClick={run}>
              {tool.action}
            </Button>
          </div>
        </div>
      )}

      {err ? <p className="text-sm text-destructive">{err}</p> : null}
    </ToolFrame>
  );
}
