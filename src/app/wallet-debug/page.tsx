"use client";

/**
 * @file Diagnostic page (`/wallet-debug`): shows what wallet provider a browser/in-app browser injects. Not indexed.
 */
import { useEffect, useState } from "react";

/** Diagnostic page: open inside the INFRA Wallet app browser and screenshot the result. */
export default function WalletDebug() {
  const [lines, setLines] = useState<string[]>([]);
  useEffect(() => {
    const out: string[] = [`UA: ${navigator.userAgent}`];
    const six: string[] = [];
    window.addEventListener("eip6963:announceProvider", (e) => {
      const d = (e as CustomEvent).detail?.info;
      six.push(`${d?.name} (${d?.rdns})`);
    });
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    const snap = (t: number) => {
      const w = window as unknown as Record<string, unknown>;
      const e = w.ethereum as Record<string, unknown> | undefined;
      const flags = e ? Object.keys(e).filter((k) => k.startsWith("is") && e[k] === true).join(",") || "none" : "-";
      out.push(
        `t=${t}ms ethereum:${e ? "YES" : "no"} flags:${flags} providers:${Array.isArray(e?.providers) ? (e!.providers as unknown[]).length : 0} rabby:${w.rabby ? "yes" : "no"} infra:${w.infra || w.infraWallet ? "yes" : "no"} 6963:[${six.join("; ")}]`,
      );
      setLines([...out]);
    };
    [0, 500, 1500, 4000].forEach((t) => setTimeout(() => snap(t), t));
  }, []);
  const tryConnect = async () => {
    try {
      const e = (window as unknown as { ethereum?: { request: (x: { method: string }) => Promise<string[]> } }).ethereum;
      if (!e) throw new Error("no window.ethereum");
      const acc = await e.request({ method: "eth_requestAccounts" });
      setLines((l) => [...l, `connected: ${acc.join(",")}`]);
    } catch (err) {
      setLines((l) => [...l, `connect error: ${(err as Error).message}`]);
    }
  };
  return (
    <main className="wrap grid gap-3 py-8">
      <h1 className="text-[1.3rem]">Wallet debug</h1>
      <button className="btn btn-b w-full" onClick={tryConnect}>Test connect</button>
      <pre className="whitespace-pre-wrap break-all rounded-xl bg-[var(--field)] p-3 text-[0.72rem]">{lines.join("\n")}</pre>
    </main>
  );
}
