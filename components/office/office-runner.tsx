"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/tools/dropzone";
import { useProcessor } from "@/components/tools/use-processor";
import { ToolFrame } from "@/components/tools/tool-frame";
import { ToolPanel } from "@/components/tools/tool-ui";
import { FilePill } from "@/components/tools/shared";
import { validateFiles } from "@/lib/files";
import { track, ToolEvents } from "@/lib/analytics";
import { convertDocumentClient } from "@/lib/office/convert-client";
import { getOfficeTool, type OfficeToolDefinition } from "@/lib/office/tools";

// Takes the slug (a serializable string) rather than the tool object, because
// the tool carries a lucide icon component that can't cross the server→client
// boundary. The lookup runs here, in the client.
export function OfficeRunner({ slug }: { slug: string }) {
  const tool = getOfficeTool(slug);
  if (!tool) return null;
  return <OfficeConvert tool={tool} />;
}

function OfficeConvert({ tool }: { tool: OfficeToolDefinition }) {
  const proc = useProcessor(tool.slug);
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const maxMb = tool.maxSizeMb;

  function add(files: File[]) {
    const { valid, error } = validateFiles(files, {
      accept: tool.accept,
      multiple: false,
      maxSizeMb: maxMb,
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

  return (
    <ToolFrame
      proc={proc}
      onReset={reset}
      processingLabel={tool.processingLabel}
      downloadLabel={tool.downloadLabel}
    >
      {!file ? (
        <div className="space-y-2">
          <Dropzone accept={tool.accept} acceptLabel={tool.acceptLabel} multiple={false} onFiles={add} />
          <p className="text-center text-xs text-muted-foreground">Max file size {maxMb} MB</p>
        </div>
      ) : (
        <div className="space-y-5">
          <FilePill name={file.name} size={file.size} onRemove={reset} />
          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={() => proc.run((report) => convertDocumentClient(tool.engine, [file]))}
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
