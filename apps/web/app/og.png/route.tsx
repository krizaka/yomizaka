import { ImageResponse } from "next/og";

export const dynamic = "force-static";

/** The social card, drawn at build: the name, the promise, the ink indigo of the brand. */
export function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "linear-gradient(135deg, #121321 0%, #111019 55%, #0c0c0e 100%)", color: "#f4f4f5", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 64, height: 80, background: "linear-gradient(45deg, #5362c6, #6d5ec9)", borderRadius: 8 }} />
          <div style={{ fontSize: 64, fontWeight: 800 }}>Yomizaka</div>
        </div>
        <div style={{ fontSize: 48, fontWeight: 700, marginTop: 40 }}>Read before you sign.</div>
        <div style={{ fontSize: 28, marginTop: 20, color: "#a1a1aa" }}>Leases, contracts and invoices — read and checked by Orazaka, every finding quoted.</div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
