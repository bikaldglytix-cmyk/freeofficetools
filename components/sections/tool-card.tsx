import { ArrowRight } from "lucide-react";
import type { ToolCardItem } from "@/lib/links";
import { toolHref } from "@/lib/links";
import { WarmLink } from "@/components/sections/warm-link";

export function ToolCard({ tool }: { tool: ToolCardItem }) {
  const Icon = tool.icon;
  return (
    <WarmLink
      href={toolHref(tool)}
      warmCategory={tool.category}
      warmSlug={tool.slug}
      className="group relative flex items-center gap-4 rounded-xl border border-transparent p-4 transition-all hover:border-border/40 hover:bg-muted/30"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background shadow-soft ring-1 ring-border/50 transition-colors group-hover:bg-primary group-hover:text-primary-foreground group-hover:ring-primary">
        <Icon className="size-5" />
      </div>
      <div className="flex-1">
        <h3 className="text-[15px] font-semibold text-foreground transition-colors group-hover:text-primary">{tool.name}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground line-clamp-1">{tool.short}</p>
      </div>
      <div className="mr-2 text-primary opacity-0 transition-all duration-300 group-hover:-translate-x-1 group-hover:opacity-100">
        <ArrowRight className="size-4" />
      </div>
    </WarmLink>
  );
}

export function ToolGrid({ tools }: { tools: ToolCardItem[] }) {
  return (
    <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((tool) => (
        <ToolCard key={tool.slug} tool={tool} />
      ))}
    </div>
  );
}
