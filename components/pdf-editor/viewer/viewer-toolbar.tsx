"use client";

import { useState } from "react";
import {
  ZoomIn,
  ZoomOut,
  Hand,
  MousePointer2,
  Search,
  ChevronUp,
  ChevronDown,
  Maximize,
  MoveHorizontal,
  Download,
  Loader2,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExportPhase } from "@/components/pdf-editor/hooks/use-pdf-export";

interface ViewerToolbarProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitWidth: () => void;
  onFitPage: () => void;
  currentPage: number; // 0-based
  numPages: number;
  onGoToPage: (index: number) => void;
  handToolActive: boolean;
  onToggleHand: () => void;
  searchOpen: boolean;
  onToggleSearch: () => void;
  onDownload: () => void;
  downloadPhase: ExportPhase;
  downloadProgress: number;
}

export function ViewerToolbar(props: ViewerToolbarProps) {
  const {
    zoom,
    onZoomIn,
    onZoomOut,
    onResetZoom,
    onFitWidth,
    onFitPage,
    currentPage,
    numPages,
    onGoToPage,
    handToolActive,
    onToggleHand,
    searchOpen,
    onToggleSearch,
    onDownload,
    downloadPhase,
    downloadProgress,
  } = props;

  // Local, editable page-number box; commits on Enter or blur. Sync to the
  // current page during render (not in an effect) when it changes externally.
  const [pageInput, setPageInput] = useState(String(currentPage + 1));
  const [prevPage, setPrevPage] = useState(currentPage);
  if (prevPage !== currentPage) {
    setPrevPage(currentPage);
    setPageInput(String(currentPage + 1));
  }

  function commitPage() {
    const n = parseInt(pageInput, 10);
    if (Number.isFinite(n)) onGoToPage(Math.min(numPages, Math.max(1, n)) - 1);
    else setPageInput(String(currentPage + 1));
  }

  return (
    <div className="flex min-h-12 items-center gap-1 overflow-x-auto border-b border-border bg-card px-2 py-1.5 [-webkit-overflow-scrolling:touch]">
      {/* Tool mode */}
      <ToolbarToggle active={!handToolActive} label="Select / text" onClick={() => handToolActive && onToggleHand()}>
        <MousePointer2 className="size-4" />
      </ToolbarToggle>
      <ToolbarToggle active={handToolActive} label="Pan (hand) — or hold Space" onClick={() => !handToolActive && onToggleHand()}>
        <Hand className="size-4" />
      </ToolbarToggle>

      <Divider />

      {/* Zoom */}
      <IconButton label="Zoom out" onClick={onZoomOut}>
        <ZoomOut className="size-4" />
      </IconButton>
      <button
        type="button"
        onClick={onResetZoom}
        className="min-w-[3.25rem] rounded-md px-2 py-1 text-center text-xs font-medium tabular-nums text-foreground hover:bg-muted"
        title="Reset to 100%"
      >
        {Math.round(zoom * 100)}%
      </button>
      <IconButton label="Zoom in" onClick={onZoomIn}>
        <ZoomIn className="size-4" />
      </IconButton>
      <IconButton label="Fit width" onClick={onFitWidth}>
        <MoveHorizontal className="size-4" />
      </IconButton>
      <IconButton label="Fit page" onClick={onFitPage}>
        <Maximize className="size-4" />
      </IconButton>

      <Divider />

      {/* Page navigation */}
      <div className="flex shrink-0 items-center gap-1">
        <IconButton
          label="Previous page"
          onClick={() => onGoToPage(Math.max(0, currentPage - 1))}
          disabled={currentPage <= 0}
        >
          <ChevronUp className="size-4" />
        </IconButton>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <input
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value.replace(/[^\d]/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitPage();
                (e.target as HTMLInputElement).blur();
              }
            }}
            onBlur={commitPage}
            inputMode="numeric"
            aria-label="Page number"
            className="h-9 w-12 rounded-md border border-input bg-card px-1 text-center text-xs tabular-nums text-foreground outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/40 sm:h-8 sm:w-10"
          />
          <span className="whitespace-nowrap tabular-nums">/ {numPages}</span>
        </div>
        <IconButton
          label="Next page"
          onClick={() => onGoToPage(Math.min(numPages - 1, currentPage + 1))}
          disabled={currentPage >= numPages - 1}
        >
          <ChevronDown className="size-4" />
        </IconButton>
      </div>

      <div className="min-w-2 flex-1" />

      {/* Search */}
      <ToolbarToggle active={searchOpen} label="Search (Ctrl/⌘+F)" onClick={onToggleSearch}>
        <Search className="size-4" />
      </ToolbarToggle>

      <Divider />

      {/* Download the edited PDF */}
      <DownloadButton onClick={onDownload} phase={downloadPhase} progress={downloadProgress} />
    </div>
  );
}

function DownloadButton({
  onClick,
  phase,
  progress,
}: {
  onClick: () => void;
  phase: ExportPhase;
  progress: number;
}) {
  const working = phase === "working";
  const done = phase === "done";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={working}
      title="Download the edited PDF"
      aria-label="Download the edited PDF"
      className={cn(
        "flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors disabled:cursor-default sm:h-8",
        done
          ? "bg-success/15 text-success ring-1 ring-success/40"
          : "bg-primary text-primary-foreground hover:bg-primary/90",
      )}
    >
      {working ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          <span className="tabular-nums">{progress}%</span>
        </>
      ) : done ? (
        <>
          <Check className="size-4" />
          Saved
        </>
      ) : (
        <>
          <Download className="size-4" />
          Download
        </>
      )}
    </button>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="flex size-9 shrink-0 touch-manipulation items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 sm:size-8"
    >
      {children}
    </button>
  );
}

function ToolbarToggle({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "flex size-9 shrink-0 touch-manipulation items-center justify-center rounded-md transition-colors sm:size-8",
        active ? "bg-primary-soft text-primary ring-1 ring-primary/40" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-border" />;
}
