"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/files";
import type { ToolDefinition } from "@/lib/tools";

/** Every runner receives the resolved tool definition. */
export interface RunnerProps {
  tool: ToolDefinition;
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-sm outline-none transition focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/40",
        props.className,
      )}
    />
  );
}

export interface RadioOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

/** Accessible radio-card group for choosing one option. */
export function RadioCards<T extends string>({
  name,
  value,
  options,
  onChange,
  columns = 3,
}: {
  name: string;
  value: T;
  options: RadioOption<T>[];
  onChange: (value: T) => void;
  columns?: number;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex flex-col rounded-lg border p-3 text-left text-sm transition-colors",
              selected
                ? "border-primary bg-primary-soft ring-1 ring-primary"
                : "border-border bg-card hover:bg-muted",
            )}
          >
            <span className="font-medium text-foreground">{opt.label}</span>
            {opt.description ? (
              <span className="mt-0.5 text-xs text-muted-foreground">{opt.description}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** A removable chip representing one selected file. */
export function FilePill({
  name,
  size,
  onRemove,
  index,
  controls,
}: {
  name: string;
  size: number;
  onRemove?: () => void;
  index?: number;
  controls?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
      {typeof index === "number" ? (
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium text-muted-foreground">
          {index + 1}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground">{formatBytes(size)}</p>
      </div>
      {controls}
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name}`}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

export function ThumbsLoading() {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" aria-live="polite">
      <span className="size-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
      Loading pages…
    </div>
  );
}
