import type { Metadata } from "next";

import { siteConfig } from "@/lib/site";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumbs } from "@/components/sections/breadcrumbs";

export const metadata: Metadata = buildMetadata({
  title: "Privacy Policy",
  description:
    "How FreeOfficeTools handles your data: files are processed in your browser and never uploaded. No accounts, no file storage, privacy-first analytics.",
  path: "/privacy",
});

const crumbs = [
  { name: "Home", path: "/" },
  { name: "Privacy", path: "/privacy" },
];

const sections: { heading: string; body: string[] }[] = [
  {
    heading: "Your files stay on your device",
    body: [
      "Our PDF and image tools process files directly in your browser. Your documents are not uploaded to our servers, not stored, and not seen by us. When you close the tab, nothing remains.",
    ],
  },
  {
    heading: "No accounts, no personal data",
    body: [
      "You don't need an account to use the tools, and we don't ask for your name, email or any personal details to process a file.",
    ],
  },
  {
    heading: "Analytics",
    body: [
      "If analytics is enabled, we use a privacy-friendly, cookieless analytics tool that records only aggregate, anonymous usage (such as which pages are visited and which tools are used). It does not track you across sites and does not collect personal information.",
    ],
  },
  {
    heading: "Cookies",
    body: [
      "We do not use advertising or tracking cookies. Any storage used is limited to what's needed for the site to function.",
    ],
  },
  {
    heading: "Contact",
    body: [
      "Questions about privacy? Reach out and we'll be happy to help. As the service grows, this policy may be updated; the date above reflects the latest version.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="container-page py-8 md:py-12">
      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      <div className="mx-auto max-w-3xl space-y-8">
        <Breadcrumbs items={crumbs} />
        <header>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Privacy Policy</h1>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            {siteConfig.name} is built to be private by default. Here&apos;s exactly how your data is
            handled.
          </p>
        </header>
        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.heading} className="space-y-2">
              <h2 className="text-xl font-semibold tracking-tight">{section.heading}</h2>
              {section.body.map((p, i) => (
                <p key={i} className="leading-relaxed text-muted-foreground">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
