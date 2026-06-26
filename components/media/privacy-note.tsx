import { ShieldCheck } from "lucide-react";

/**
 * Required, always-visible privacy reassurance for media tools.
 * Worded honestly: browser processing is the default, with room for an
 * optional server path on heavier tools in future without changing this promise.
 */
export function MediaPrivacyNote() {
  return (
    <p className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 px-3 py-2 text-xs font-medium text-foreground">
      <ShieldCheck className="size-4 shrink-0 text-success" />
      Files are processed locally in your browser whenever possible.
    </p>
  );
}
