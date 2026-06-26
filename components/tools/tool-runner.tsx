"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import { Loader2 } from "lucide-react";
import { getTool } from "@/lib/tools";
import type { RunnerProps } from "@/components/tools/shared";

function RunnerSkeleton() {
  return (
    <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

// Each tool's interactive widget is loaded only in the browser, so the PDF
// engines never ship to the server and never block the page's first paint.
// Note: next/dynamic options must be an inline object literal at each call site.
const runners: Record<string, ComponentType<RunnerProps>> = {
  "merge-pdf": dynamic(() => import("./runners/merge-pdf").then((m) => m.MergePdf), {
    ssr: false,
    loading: RunnerSkeleton,
  }),
  "split-pdf": dynamic(() => import("./runners/split-pdf").then((m) => m.SplitPdf), {
    ssr: false,
    loading: RunnerSkeleton,
  }),
  "compress-pdf": dynamic(() => import("./runners/compress-pdf").then((m) => m.CompressPdf), {
    ssr: false,
    loading: RunnerSkeleton,
  }),
  "rotate-pdf": dynamic(() => import("./runners/rotate-pdf").then((m) => m.RotatePdf), {
    ssr: false,
    loading: RunnerSkeleton,
  }),
  "delete-pdf-pages": dynamic(() => import("./runners/delete-pdf-pages").then((m) => m.DeletePdfPages), {
    ssr: false,
    loading: RunnerSkeleton,
  }),
  "extract-pdf-pages": dynamic(() => import("./runners/extract-pdf-pages").then((m) => m.ExtractPdfPages), {
    ssr: false,
    loading: RunnerSkeleton,
  }),
  "reorder-pdf-pages": dynamic(() => import("./runners/reorder-pdf-pages").then((m) => m.ReorderPdfPages), {
    ssr: false,
    loading: RunnerSkeleton,
  }),
  "jpg-to-pdf": dynamic(() => import("./runners/jpg-to-pdf").then((m) => m.JpgToPdf), {
    ssr: false,
    loading: RunnerSkeleton,
  }),
  "pdf-to-jpg": dynamic(() => import("./runners/pdf-to-jpg").then((m) => m.PdfToJpg), {
    ssr: false,
    loading: RunnerSkeleton,
  }),
  "watermark-pdf": dynamic(() => import("./runners/watermark-pdf").then((m) => m.WatermarkPdf), {
    ssr: false,
    loading: RunnerSkeleton,
  }),
  "edit-pdf": dynamic(() => import("./runners/edit-pdf").then((m) => m.EditPdf), {
    ssr: false,
    loading: RunnerSkeleton,
  }),
};

export function ToolRunner({ slug }: { slug: string }) {
  const tool = getTool(slug);
  const Runner = runners[slug];
  if (!tool || !Runner) return null;
  return <Runner tool={tool} />;
}
