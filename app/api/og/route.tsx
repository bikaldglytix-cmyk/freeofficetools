import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";

export const runtime = "nodejs";

/**
 * Dynamic Open Graph image. Renders the page title on a calm branded card.
 * Generated on demand (and cached) so we ship zero static OG assets.
 */
export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawTitle = searchParams.get("title")?.slice(0, 120) || siteConfig.name;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #ffffff 0%, #eef2ff 100%)",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#2f5cdb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 36,
              fontWeight: 700,
            }}
          >
            F
          </div>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#1e293b" }}>
            <span style={{ color: "#2f5cdb" }}>Free</span>
            <span>OfficeTools</span>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 800,
            color: "#0f172a",
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            maxWidth: 1000,
          }}
        >
          {rawTitle}
        </div>

        <div style={{ display: "flex", fontSize: 28, color: "#475569" }}>
          Free PDF &amp; document tools — private and in your browser
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
