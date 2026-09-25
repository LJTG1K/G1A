import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "G1A — every buying sheet, one store",
    short_name: "G1A",
    description: "All your product spreadsheets in one clean storefront, with pin boards that track price changes.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    categories: ["shopping", "lifestyle"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Boards", url: "/boards", icons: [{ src: "/icons/192", sizes: "192x192" }] },
      { name: "Add a sheet", url: "/sources/new", icons: [{ src: "/icons/192", sizes: "192x192" }] },
    ],
  };
}
