"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { getMediaTool } from "@/lib/media/tools";

function RunnerSkeleton() {
  return (
    <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

// The media runners (and, through them, FFmpeg.wasm) load only in the browser,
// only after a media tool page mounts — never in the homepage or content
// bundles, and never on the server. The ~31 MB core itself loads later still,
// on the first conversion, via lib/media/ffmpeg.ts.
const ConvertRunner = dynamic(
  () => import("@/components/media/convert-runner").then((m) => m.ConvertRunner),
  { ssr: false, loading: RunnerSkeleton },
);
const TrimRunner = dynamic(
  () => import("@/components/media/trim-runner").then((m) => m.TrimRunner),
  { ssr: false, loading: RunnerSkeleton },
);

export function MediaRunner({ slug }: { slug: string }) {
  const tool = getMediaTool(slug);
  if (!tool) return null;
  const Runner = tool.runner === "trim" ? TrimRunner : ConvertRunner;
  return <Runner tool={tool} />;
}
