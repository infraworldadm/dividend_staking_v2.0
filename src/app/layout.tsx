import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";
import { WalletProvider } from "@/components/providers/WalletProvider";
import { Motion } from "@/components/motion/Motion";
import { themeInitScript } from "@/components/motion/ThemeToggle";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://dividend-staking-v2-0.vercel.app";
const TITLE = "INFRA Staking — Stake reAED, earn network revenue";
const DESC =
  "Stake reAED in the INFRA Dividend Pool and earn a monthly share of real INFRA network fees. No inflation, no emissions — 1 to 12 month locks, monthly payouts, connect with INFRA Wallet.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s · INFRA Staking" },
  description: DESC,
  applicationName: "INFRA Staking",
  keywords: [
    "INFRA", "INFRA Network", "reAED", "staking", "dividend pool", "stake reAED", "network revenue",
    "AED stablecoin", "UAE blockchain", "Dubai crypto", "INFRA Wallet", "passive income", "monthly rewards", "ReSystem",
  ],
  authors: [{ name: "INFRA Network", url: "https://infraworld.org" }],
  creator: "INFRA Network",
  publisher: "ReSystem",
  category: "finance",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "INFRA Staking",
    title: TITLE,
    description: DESC,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESC,
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large" } },
  manifest: "/manifest.webmanifest",
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6fb" },
    { media: "(prefers-color-scheme: dark)", color: "#06080e" },
  ],
  width: "device-width",
  initialScale: 1,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "INFRA Staking",
  url: SITE_URL,
  description: DESC,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  image: `${SITE_URL}/opengraph-image.png`,
  publisher: { "@type": "Organization", name: "INFRA Network", url: "https://infraworld.org" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </head>
      <body>
        <div className="amb" aria-hidden>
          <i />
          <i />
        </div>
        <WalletProvider>{children}</WalletProvider>
        <Motion />
      </body>
    </html>
  );
}
