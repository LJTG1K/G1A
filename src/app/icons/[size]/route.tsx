import { ImageResponse } from "next/og";
import { BrandIcon } from "@/lib/brand-icon";

const VARIANTS: Record<string, { px: number; maskable: boolean }> = {
  "192": { px: 192, maskable: false },
  "512": { px: 512, maskable: false },
  "maskable-512": { px: 512, maskable: true },
};

export function generateStaticParams() {
  return Object.keys(VARIANTS).map((size) => ({ size }));
}

/** PNG icons referenced by the web app manifest. */
export async function GET(_req: Request, ctx: RouteContext<"/icons/[size]">) {
  const v = VARIANTS[(await ctx.params).size];
  if (!v) return new Response("Not found", { status: 404 });
  return new ImageResponse(<BrandIcon size={v.px} maskable={v.maskable} />, { width: v.px, height: v.px });
}
