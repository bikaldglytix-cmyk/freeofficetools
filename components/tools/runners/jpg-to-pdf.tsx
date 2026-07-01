"use client";

import { useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dropzone } from "@/components/tools/dropzone";
import { useProcessor } from "@/components/tools/use-processor";
import { ToolFrame } from "@/components/tools/tool-frame";
import { FilePill, Field, RadioCards, type RunnerProps } from "@/components/tools/shared";
import { validateFiles } from "@/lib/files";
import type { PageSize, Orientation } from "@/lib/pdf/images-to-pdf";
import { runPdfOp } from "@/lib/pdf/worker/pdf-worker-client";

export function JpgToPdf({ tool }: RunnerProps) {
  const proc = useProcessor(tool.slug);
  const [files, setFiles] = useState<File[]>([]);
  const [pageSize, setPageSize] = useState<PageSize>("a4");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [margin, setMargin] = useState(24);
  const [err, setErr] = useState<string | null>(null);

  function add(incoming: File[]) {
    const combined = [...files, ...incoming];
    const { valid, error } = validateFiles(combined, { accept: tool.accept, multiple: true });
    if (error) return setErr(error);
    setErr(null);
    setFiles(valid);
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= files.length) return;
    const next = [...files];
    [next[i], next[j]] = [next[j], next[i]];
    setFiles(next);
  }

  function reset() {
    setFiles([]);
    setErr(null);
    proc.reset();
  }

  return (
    <ToolFrame proc={proc} onReset={reset} processingLabel="Building your PDF…" downloadLabel="Download PDF">
      <Dropzone
        accept={tool.accept}
        acceptLabel={tool.acceptLabel}
        multiple
        compact={files.length > 0}
        onFiles={add}
      />
      {err ? <p className="text-sm text-destructive">{err}</p> : null}

      {files.length > 0 ? (
        <div className="space-y-4">
          <ul className="space-y-2">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`}>
                <FilePill
                  name={f.name}
                  size={f.size}
                  index={i}
                  onRemove={() => setFiles(files.filter((_, idx) => idx !== i))}
                  controls={
                    <div className="flex items-center">
                      <button
                        type="button"
                        aria-label={`Move ${f.name} up`}
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-30"
                      >
                        <ArrowUp className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${f.name} down`}
                        disabled={i === files.length - 1}
                        onClick={() => move(i, 1)}
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-30"
                      >
                        <ArrowDown className="size-4" />
                      </button>
                    </div>
                  }
                />
              </li>
            ))}
          </ul>

          <Field label="Page size">
            <RadioCards
              name="Page size"
              columns={3}
              value={pageSize}
              onChange={setPageSize}
              options={[
                { value: "a4", label: "A4", description: "210 × 297 mm" },
                { value: "letter", label: "US Letter", description: "8.5 × 11 in" },
                { value: "fit", label: "Fit image", description: "Match each image" },
              ]}
            />
          </Field>

          {pageSize !== "fit" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Orientation">
                <RadioCards
                  name="Orientation"
                  columns={2}
                  value={orientation}
                  onChange={setOrientation}
                  options={[
                    { value: "portrait", label: "Portrait" },
                    { value: "landscape", label: "Landscape" },
                  ]}
                />
              </Field>
              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">Margin</span>
                  <span className="text-muted-foreground">{margin} pt</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={72}
                  step={4}
                  value={margin}
                  onChange={(e) => setMargin(Number(e.target.value))}
                  className="w-full accent-[var(--color-primary)]"
                  aria-label="Margin"
                />
              </div>
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button
              size="lg"
              onClick={() =>
                proc.run((report) =>
                  runPdfOp("images-to-pdf", files, { pageSize, orientation, margin }, report),
                )
              }
            >
              Convert to PDF
            </Button>
          </div>
        </div>
      ) : null}
    </ToolFrame>
  );
}
