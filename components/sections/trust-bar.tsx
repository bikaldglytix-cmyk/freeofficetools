import { ShieldCheck, Zap, BadgeCheck, Lock } from "lucide-react";

const items = [
  { icon: ShieldCheck, title: "Private by design", text: "Files are processed in your browser." },
  { icon: BadgeCheck, title: "Free & no sign-up", text: "No account, no email, no limits." },
  { icon: Zap, title: "Fast", text: "No upload wait — work starts instantly." },
  { icon: Lock, title: "No watermarks", text: "Clean output, every time." },
];

export function TrustBar() {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <li
          key={item.title}
          className="group flex flex-col gap-3 rounded-2xl border border-transparent p-5 transition-colors hover:border-border/30 hover:bg-muted/10"
        >
          <div className="flex size-10 items-center justify-center rounded-xl bg-background shadow-soft ring-1 ring-border/50 text-foreground transition-colors group-hover:ring-primary group-hover:text-primary">
            <item.icon className="size-4" />
          </div>
          <div>
            <p className="font-medium tracking-tight text-foreground">{item.title}</p>
            <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{item.text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
