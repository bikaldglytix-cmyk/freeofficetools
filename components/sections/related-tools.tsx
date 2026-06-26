import type { ToolCardItem } from "@/lib/links";
import { ToolCard } from "@/components/sections/tool-card";

export function RelatedTools({ tools }: { tools: ToolCardItem[] }) {
  if (!tools.length) return null;
  return (
    <section aria-labelledby="related-heading">
      <h2 id="related-heading" className="text-2xl font-semibold tracking-tight">
        Related tools
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tools.map((tool) => (
          <ToolCard key={tool.slug} tool={tool} />
        ))}
      </div>
    </section>
  );
}
