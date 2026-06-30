"use client";

import { FileText, ArrowRight, Combine, CheckCircle2 } from "lucide-react";

export function AppMockup() {
  return (
    <div className="relative mx-auto w-full max-w-4xl pt-8 sm:pt-16">
      {/* Main Browser/App Window */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-lift)]">

        {/* App Titlebar */}
        <div className="flex items-center gap-2 border-b border-border/50 bg-muted/30 px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex shrink-0 gap-1.5">
            <div className="size-3 rounded-full bg-destructive/80" />
            <div className="size-3 rounded-full bg-warning/80" />
            <div className="size-3 rounded-full bg-success/80" />
          </div>
          <div className="mx-auto flex h-6 min-w-0 max-w-64 flex-1 items-center justify-center truncate rounded-md bg-background/50 px-2 text-[11px] font-medium text-muted-foreground shadow-sm">
            freeofficetools.com/merge-pdf
          </div>
        </div>

        {/* App Content */}
        <div className="flex flex-col items-center justify-center p-5 sm:p-16">
          <div className="relative flex w-full max-w-lg flex-col items-center rounded-xl border border-border/40 bg-card p-5 shadow-soft sm:p-8">

            <div className="mb-6 flex items-center justify-center gap-3 sm:gap-4">
              {/* File 1 */}
              <div className="relative flex h-20 w-16 flex-col items-center justify-center rounded-lg border border-primary/20 bg-primary/5 shadow-sm sm:h-24 sm:w-20">
                <FileText className="mb-2 size-6 text-primary" />
                <span className="text-[11px] font-medium text-primary">doc_1.pdf</span>
                <div className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-background border border-border shadow-sm">
                  <span className="text-[10px] font-bold">1</span>
                </div>
              </div>

              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Combine className="size-4" />
              </div>

              {/* File 2 */}
              <div className="relative flex h-20 w-16 flex-col items-center justify-center rounded-lg border border-primary/20 bg-primary/5 shadow-sm sm:h-24 sm:w-20">
                <FileText className="mb-2 size-6 text-primary" />
                <span className="text-[11px] font-medium text-primary">doc_2.pdf</span>
                <div className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-background border border-border shadow-sm">
                  <span className="text-[10px] font-bold">2</span>
                </div>
              </div>
            </div>

            {/* Fake progress bar / action */}
            <div className="w-full space-y-3">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="flex items-center gap-1.5 text-foreground">
                  <CheckCircle2 className="size-3.5 text-success" /> Merging complete
                </span>
                <span className="text-muted-foreground">100%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-full bg-primary rounded-full" />
              </div>
            </div>

            <button className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg bg-foreground py-2.5 text-sm font-medium text-background transition-transform hover:scale-[1.02] shadow-lift">
              Download Merged PDF <ArrowRight className="size-4" />
            </button>

          </div>
        </div>

      </div>
    </div>
  );
}
