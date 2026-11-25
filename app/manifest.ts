import type { MetadataRoute } from "next";

/** Lets phones add Ribriz to the home screen with the brand icon. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/me",
    name: "Ribriz Travel",
    short_name: "Ribriz",
    description: "Your trips, tickets and Riya, your travel agent, in one app.",
    // installed from inside the traveller app it opens there; signed-out visitors are sent to sign in
    start_url: "/me?source=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f7ff",
    theme_color: "#0b4fc4",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcuts: [
      { name: "Wallet", short_name: "Wallet", url: "/me/wallet", description: "Tickets, vouchers and receipts" },
      { name: "My trips", short_name: "Trips", url: "/me/trips" },
    ],
  };
}
