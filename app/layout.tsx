import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next"
import { siteConfig } from "@/lib/site";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Analytics } from "@/components/analytics";
import { Analytics as VercelAnalytics } from "@vercel/analytics/next";
import { ThemeProvider } from "@/components/theme-provider";
import { ServiceWorker } from "@/components/service-worker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  // Plain string (no title template): per-page titles are self-branded in
  // buildMetadata() (lib/seo.ts), which appends the brand only when it fits under
  // the SERP length limit. A template here would double-brand titles that already
  // include the brand (e.g. the homepage).
  title: `${siteConfig.name} — Free PDF & Document Tools`,
  description: siteConfig.description,
  applicationName: siteConfig.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: `${siteConfig.name} — Free PDF & Document Tools`,
    description: siteConfig.description,
    locale: siteConfig.locale,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${siteConfig.name} — Free PDF & Document Tools`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: siteConfig.twitter,
    title: `${siteConfig.name} — Free PDF & Document Tools`,
    description: siteConfig.description,
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  verification: siteConfig.googleSiteVerification
    ? { google: siteConfig.googleSiteVerification }
    : undefined,
  category: "technology",
  icons: {
    icon: [
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/favicon/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: ["/favicon/favicon.ico"],
  },
};

export const viewport: Viewport = {
  themeColor: "#2f5cdb",
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth" className={`${geistSans.variable} h-full`}>
      <body className="flex min-h-full flex-col antialiased">
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-NBNYLWRHLT" strategy="afterInteractive" />
        <Script id="google-tag-manager" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-NBNYLWRHLT');`}
        </Script>
        <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
          >
            Skip to content
          </a>

          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />

          <Analytics />
          <VercelAnalytics />
          <ServiceWorker />
        </ThemeProvider>
      </body>
    </html>
  );
}
