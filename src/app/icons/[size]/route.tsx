import { ImageResponse } from "next/og";
import { brand } from "@/config/brand";

const SIZES = [180, 192, 512] as const;

export const dynamic = "force-static";

export function generateStaticParams() {
  return SIZES.map((size) => ({ size: String(size) }));
}

/** App icons drawn from the brand colours, so renaming/recolouring needs no new assets. */
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: raw } = await params;
  const size = SIZES.find((s) => String(s) === raw) ?? 192;
  const dot = size * 0.17;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: brand.colors.primary,
        }}
      >
        <div
          style={{
            width: size * 0.64,
            height: size * 0.64,
            borderRadius: "50%",
            border: `${size * 0.035}px solid rgba(255,255,255,0.6)`,
            position: "relative",
            display: "flex",
          }}
        >
          {[
            { left: "14%", top: "18%", opacity: 1 },
            { left: "56%", top: "18%", opacity: 0.85 },
            { left: "35%", top: "56%", opacity: 0.7 },
          ].map((p, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: p.left,
                top: p.top,
                width: dot,
                height: dot,
                borderRadius: "50%",
                background: `rgba(255,255,255,${p.opacity})`,
              }}
            />
          ))}
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
