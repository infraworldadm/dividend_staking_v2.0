/**
 * @file Layout for /wallet-debug — only sets noindex so the diagnostic page stays out of search.
 */
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Wallet debug", robots: { index: false, follow: false } };

export default function WalletDebugLayout({ children }: { children: React.ReactNode }) {
  return children;
}
