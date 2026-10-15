import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "INFRA Staking",
    short_name: "INFRA Stake",
    description: "Stake reAED and earn a monthly share of INFRA network revenue.",
    start_url: "/",
    display: "standalone",
    background_color: "#06080e",
    theme_color: "#1f5bff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
