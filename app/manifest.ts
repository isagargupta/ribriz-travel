import type { MetadataRoute } from "next";

/** Lets phones add Ribriz to the home screen with the brand icon. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ribriz Travel",
    short_name: "Ribriz",
    description: "Holiday packages, group tours and beach escapes with clear prices.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7ff",
    theme_color: "#0b4fc4",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
