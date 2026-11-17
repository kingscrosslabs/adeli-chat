import { ImageResponse } from "next/og";

// The share card for the landing page (og:image and twitter:image). Colours are the brand's (docs/brand.md section 3).
// ImageResponse cannot read CSS variables, so the hex values are written out here.
const LEDA_PURPLE = "#702EC7";
const LEDA_PINK = "#F90EF5";
const LEDA_INK = "#1C1426";
const PURPLE_50 = "#F6F2FC";

export const alt = "LedaChat: Turn Instagram comments into DMs, for free";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: PURPLE_50,
          color: LEDA_INK,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 18,
              background: LEDA_PURPLE,
              color: "#FFFFFF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 44,
              fontWeight: 700,
            }}
          >
            L
          </div>
          <div style={{ fontSize: 48, fontWeight: 700, color: LEDA_PURPLE }}>LedaChat</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1.5, maxWidth: 1000 }}>
            Turn Instagram comments into DMs, for free
          </div>
          <div style={{ width: 160, height: 10, borderRadius: 5, background: LEDA_PINK }} />
        </div>
        <div style={{ display: "flex", fontSize: 32, color: "#625A70" }}>Free and open source. Comment to DM, with an MCP.</div>
      </div>
    ),
    { ...size },
  );
}
