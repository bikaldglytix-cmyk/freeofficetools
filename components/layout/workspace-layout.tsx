import { ReactNode } from "react";
import { ShieldCheck, Zap, Lock } from "lucide-react";

interface WorkspaceLayoutProps {
  title: string;
  subtitle: string;
  runner: ReactNode;
  children: ReactNode; // Supporting content
}

export function WorkspaceLayout({ title, subtitle, runner, children }: WorkspaceLayoutProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Dashboard Header */}
      <div className="border-b border-border/40 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        {/* Main Workspace Area */}
        <div className="flex min-h-[500px] flex-col rounded-xl border border-border/40 bg-card shadow-soft overflow-hidden">
          {runner}
        </div>

        {/* Dashboard Context Sidebar */}
        <aside className="space-y-6">
          <div className="rounded-xl border border-border/40 bg-card p-5 shadow-soft">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              Security & Performance
            </h3>
            <ul className="space-y-4">
              <li className="flex gap-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" />
                <div>
                  <p className="text-[13px] font-medium text-foreground">Local Processing</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Files never leave your device.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <Zap className="mt-0.5 size-4 shrink-0 text-warning" />
                <div>
                  <p className="text-[13px] font-medium text-foreground">Lightning Fast</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Zero upload or download times.
                  </p>
                </div>
              </li>
              <li className="flex gap-3">
                <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-[13px] font-medium text-foreground">Private Output</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    No tracking, no watermarks.
                  </p>
                </div>
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-border/40 bg-card p-5 shadow-soft">
             <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              Documentation
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Read the guides below for advanced usage and tips on how to get the most out of this tool.
            </p>
          </div>
        </aside>
      </div>

      {/* Supporting Content (FAQs, Guides, Related) */}
      <div className="border-t border-border/40 pt-8">
        {children}
      </div>
    </div>
  );
}
