"use client";

import { useState } from "react";
import Link from "next/link";
import { Server, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/tools/dropzone";
import { useProcessor } from "@/components/tools/use-processor";
import { ToolFrame } from "@/components/tools/tool-frame";
import { ToolPanel } from "@/components/tools/tool-ui";
import { FilePill } from "@/components/tools/shared";
import { validateFiles } from "@/lib/files";
import { track, ToolEvents } from "@/lib/analytics";
import { convertDocument, isEngineReady, officeUploadLimitMb } from "@/lib/office/convert";
import { getOfficeTool, type OfficeToolDefinition } from "@/lib/office/tools";

// Takes the slug (a serializable string) rather than the tool object, because
// the tool carries a lucide icon component that can't cross the server→client
// boundary. The lookup runs here, in the client.
export function OfficeRunner({ slug }: { slug: string }) {
  const tool = getOfficeTool(slug);
  if (!tool) return null;
  if (!isEngineReady(tool.engine)) return <OfficeComingSoon />;
  return <OfficeConvert tool={tool} />;
}

/**
 * Honest placeholder shown until a conversion backend is connected. No fake
 * convert button — it explains the architecture and points to the tools that
 * already run instantly in the browser.
 */
function OfficeComingSoon() {
  return (
    <ToolPanel>
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Server className="size-7" />
        </span>
        <div className="max-w-md">
          <h2 className="text-lg font-semibold text-foreground">Server-powered conversion</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            For pixel-perfect formatting, this conversion runs on a secure server rather than in your
            browser. We&apos;re connecting it now — check back soon.
          </p>
        </div>
        <p className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 px-3 py-2 text-xs font-medium text-foreground">
          <ShieldCheck className="size-4 shrink-0 text-success" />
          When live, files are converted securely and deleted right away — never stored.
        </p>
        <p className="text-sm text-muted-foreground">
          Meanwhile, our{" "}
          <Link href="/pdf-tools" className="font-medium text-primary hover:underline">
            PDF tools
          </Link>{" "}
          and{" "}
          <Link href="/media-tools" className="font-medium text-primary hover:underline">
            video &amp; audio tools
          </Link>{" "}
          run instantly in your browser.
        </p>
      </div>
    </ToolPanel>
  );
}

function OfficeConvert({ tool }: { tool: OfficeToolDefinition }) {
  const proc = useProcessor(tool.slug);
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // The real upload ceiling depends on transport (direct backend vs same-origin
  // proxy). Validating against it here prevents a doomed upload that would only
  // come back as a 413 in the console.
  const maxMb = officeUploadLimitMb(tool.maxSizeMb);

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
              onClick={() => proc.run((report) => convertDocument(tool.engine, [file], { onProgress: report }))}
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
