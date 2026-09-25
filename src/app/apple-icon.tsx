import { ImageResponse } from "next/og";
import { BrandIcon } from "@/lib/brand-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS home screen icon (iOS rounds the corners itself, so fill the square). */
export default function AppleIcon() {
  return new ImageResponse(<BrandIcon size={180} maskable />, size);
}
