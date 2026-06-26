import { newId } from "@/lib/pdf/editor/model/ids";
import type { Rect } from "@/lib/pdf/editor/model/types";
import { unionRects } from "./geometry";
import type { GlyphRun, TextBlock, TextLine, TextSpan } from "./types";

export interface ReconstructionOptions {
  lineToleranceRatio?: number;
  wordGapRatio?: number;
  paragraphGapRatio?: number;
  columnGapRatio?: number;
}

const DEFAULT_OPTIONS: Required<ReconstructionOptions> = {
  lineToleranceRatio: 0.55,
  wordGapRatio: 0.42,
  paragraphGapRatio: 1.25,
  columnGapRatio: 3,
};

export function reconstructTextBlocks(input: {
  documentId: string;
  pageId: string;
  runs: GlyphRun[];
  options?: ReconstructionOptions;
}): TextBlock[] {
  const options = { ...DEFAULT_OPTIONS, ...input.options };
  const lines = groupRunsIntoLines(input.runs, options);
  return groupLinesIntoBlocks(input.documentId, input.pageId, lines, options);
}

export function groupRunsIntoLines(runs: readonly GlyphRun[], options: Required<ReconstructionOptions>): TextLine[] {
  const sorted = [...runs].sort((a, b) => (Math.abs(a.bounds.y - b.bounds.y) > 2 ? a.bounds.y - b.bounds.y : a.bounds.x - b.bounds.x));
  const lineRuns: GlyphRun[][] = [];

  for (const run of sorted) {
    const target = lineRuns.find((line) => {
      const box = unionRects(line.map((r) => r.bounds));
      const tolerance = Math.max(run.bounds.height, box.height) * options.lineToleranceRatio;
      return Math.abs(run.bounds.y - box.y) <= tolerance;
    });
    if (target) target.push(run);
    else lineRuns.push([run]);
  }

  return lineRuns
    .map((line) => [...line].sort((a, b) => a.bounds.x - b.bounds.x))
    .map((line) => {
      const spans = runsToSpans(line, options);
      const bounds = unionRects(spans.map((s) => s.bounds));
      return {
        id: newId("txt_line"),
        text: spans.map((s) => s.text).join(""),
        bounds,
        spans,
        baseline: Math.max(...line.map((r) => r.bounds.y + r.bounds.height)),
        direction: "ltr" as const,
      };
    })
    .sort((a, b) => a.bounds.y - b.bounds.y);
}

function runsToSpans(runs: readonly GlyphRun[], options: Required<ReconstructionOptions>): TextSpan[] {
  const spans: TextSpan[] = [];
  let current: GlyphRun[] = [];
  for (const run of runs) {
    const prev = current[current.length - 1];
    if (prev) {
      const gap = run.bounds.x - (prev.bounds.x + prev.bounds.width);
      const threshold = Math.max(prev.style.fontSize, run.style.fontSize) * options.wordGapRatio;
      if (gap > threshold) {
        spans.push(spanFromRuns(current, " "));
        current = [];
      }
    }
    current.push(run);
  }
  if (current.length) spans.push(spanFromRuns(current, ""));
  return spans;
}

function spanFromRuns(runs: GlyphRun[], suffix: string): TextSpan {
  const text = runs.map((r) => r.text).join("") + suffix;
  return {
    id: newId("txt_span"),
    text,
    bounds: unionRects(runs.map((r) => r.bounds)),
    runs,
    style: runs[0].style,
  };
}

function groupLinesIntoBlocks(
  documentId: string,
  pageId: string,
  lines: readonly TextLine[],
  options: Required<ReconstructionOptions>,
): TextBlock[] {
  const blocks: TextLine[][] = [];
  let current: TextLine[] = [];
  for (const line of lines) {
    const prev = current[current.length - 1];
    if (prev) {
      const verticalGap = line.bounds.y - (prev.bounds.y + prev.bounds.height);
      const indentDelta = Math.abs(line.bounds.x - prev.bounds.x);
      const paragraphGap = Math.max(prev.bounds.height, line.bounds.height) * options.paragraphGapRatio;
      const columnGap = Math.max(prev.bounds.height, line.bounds.height) * options.columnGapRatio;
      if (verticalGap > paragraphGap || indentDelta > columnGap) {
        blocks.push(current);
        current = [];
      }
    }
    current.push(line);
  }
  if (current.length) blocks.push(current);

  return blocks.map((blockLines) => {
    const bounds = unionRects(blockLines.map((line) => line.bounds));
    const text = blockLines.map((line) => line.text.trimEnd()).join("\n");
    return {
      id: newId("txt_block"),
      documentId,
      pageId,
      text,
      bounds,
      lines: blockLines,
      style: blockLines[0].spans[0]?.style,
      transforms: { rotation: 0, matrix: [1, 0, 0, 1, 0, 0] },
      opacity: 1,
      zIndex: 0,
      provenance: {
        kind: "native",
        pdfItemIds: blockLines.flatMap((line) => line.spans.flatMap((span) => span.runs.map((run) => run.id))),
        confidence: 1,
        editable: "overlay-replacement",
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {},
    } satisfies TextBlock;
  });
}

export function inferBoundsFromText(text: string, x: number, y: number, fontSize: number): Rect {
  const lines = text.split(/\r?\n/);
  const width = Math.max(40, ...lines.map((line) => line.length * fontSize * 0.55));
  return { x, y, width, height: Math.max(fontSize * 1.4, lines.length * fontSize * 1.25) };
}
