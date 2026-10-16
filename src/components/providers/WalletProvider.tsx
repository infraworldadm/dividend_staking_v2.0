"use client";

/**
 * @file App-wide providers: wagmi config, React Query and RainbowKit (theme-aware).
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { useTheme } from "@/components/motion/ThemeToggle";
import { WagmiProvider } from "wagmi";
import { useState } from "react";
import { wagmiConfig } from "@/lib/web3/wagmi";
import { OpenInInfraWallet } from "@/components/providers/OpenInInfraWallet";

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const mode = useTheme();
  const rkTheme =
    mode === "dark"
      ? darkTheme({ accentColor: "#1F5BFF", borderRadius: "medium", fontStack: "system" })
      : lightTheme({ accentColor: "#1F5BFF", borderRadius: "medium", fontStack: "system" });

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={rkTheme}
        >
          {children}
          <OpenInInfraWallet />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
