import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";
import { WalletProvider } from "@/components/providers/WalletProvider";
import { Motion } from "@/components/motion/Motion";
import { themeInitScript } from "@/components/motion/ThemeToggle";

export const metadata: Metadata = {
  title: "INFRA Staking — Dividend Pool",
  description: "Stake reAED in the INFRA Dividend Pool and earn a share of real network revenue.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
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
