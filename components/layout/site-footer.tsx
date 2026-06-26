import Link from "next/link";
import { Command, ShieldCheck } from "lucide-react";
import { footerNav, siteConfig } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/20 bg-background pb-12 pt-16">
      <div className="container-page">
        <div className="flex flex-col justify-between gap-12 md:flex-row md:items-start">
          <div className="max-w-xs">
            <Link href="/" className="group flex items-center gap-2 font-medium tracking-tight text-foreground transition-colors hover:text-primary">
              <span className="flex size-6 items-center justify-center rounded bg-foreground text-background transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Command className="size-3.5" />
              </span>
              <span className="text-sm">FreeOfficeTools</span>
            </Link>
            <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
              {siteConfig.description}
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-border/40 bg-muted/20 px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <ShieldCheck className="size-3.5 text-primary" />
              Processed locally
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 md:gap-12">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">PDF tools</h2>
              <ul className="mt-4 space-y-2.5">
                {footerNav.pdf.slice(0, 4).map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">
                      {link.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Office tools</h2>
              <ul className="mt-4 space-y-2.5">
                {footerNav.office.slice(0, 4).map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">
                      {link.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Video &amp; audio</h2>
              <ul className="mt-4 space-y-2.5">
                {footerNav.media.slice(0, 4).map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">
                      {link.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">Company</h2>
              <ul className="mt-4 space-y-2.5">
                {footerNav.company.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">
                      {link.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-border/20 pt-8 text-xs text-muted-foreground/70 sm:flex-row">
          <p>© {new Date().getFullYear()} {siteConfig.name}.</p>
          <div className="flex gap-4">
            <span>No sign-up</span>
            <span>·</span>
            <span>No uploads</span>
            <span>·</span>
            <span>Private</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
