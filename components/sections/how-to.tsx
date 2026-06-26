import type { ToolStep } from "@/lib/tools";

export function HowTo({ title, steps }: { title: string; steps: ToolStep[] }) {
  return (
    <section aria-labelledby="how-to-heading">
      <h2 id="how-to-heading" className="text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      <ol className="mt-6 grid gap-5 sm:grid-cols-3">
        {steps.map((step, i) => (
          <li key={i} className="relative rounded-xl border border-border bg-card p-5">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {i + 1}
            </span>
            <h3 className="mt-3 font-semibold text-foreground">{step.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
