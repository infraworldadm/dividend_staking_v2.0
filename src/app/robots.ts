/**
 * @file robots.txt — allows the public site, blocks /api. Private pages (/admin, /wallet-debug) are NOT listed here so their paths aren't advertised; they carry noindex meta instead.
 */
import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://dividend-staking-v2-0.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
