"use client";

/**
 * @file "Open in INFRA Wallet" help sheet.
 *
 * Shown when someone taps INFRA Wallet in a phone browser (Safari/Chrome), where no wallet is
 * injected. The fix is to load this page inside the INFRA Wallet app's built-in browser, so the
 * sheet explains how and offers a one-tap "Copy link". Triggered by OPEN_IN_APP_EVENT from
 * src/lib/web3/infraWallet.ts.
 */
import { useEffect, useState } from "react";
import { Check, Copy, Globe, X } from "lucide-react";
import { OPEN_IN_APP_EVENT } from "@/lib/web3/infraWallet";

export function OpenInInfraWallet() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const show = () => {
      setCopied(false);
      setOpen(true);
    };
    window.addEventListener(OPEN_IN_APP_EVENT, show);
    return () => window.removeEventListener(OPEN_IN_APP_EVENT, show);
  }, []);

  if (!open) return null;
  const url = typeof window !== "undefined" ? window.location.origin : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // older iOS: fall back to a temporary input
      const i = document.createElement("input");
      i.value = url;
      document.body.appendChild(i);
      i.select();
      document.execCommand("copy");
      i.remove();
    }
    setCopied(true);
  };

  return (
    <div className="oia" role="dialog" aria-modal="true" aria-label="Open in INFRA Wallet" onClick={() => setOpen(false)}>
      <div className="oia-card" onClick={(e) => e.stopPropagation()}>
        <button className="oia-x" aria-label="Close" onClick={() => setOpen(false)}>
          <X className="h-4 w-4" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/infra-wallet.png" alt="" className="h-12 w-12 rounded-xl" />
        <h3>Open in INFRA Wallet</h3>
        <p>Your phone browser can’t reach the wallet. Open this page inside the INFRA Wallet app:</p>
        <ol>
          <li><b>1</b><span>Copy the link below</span></li>
          <li><b>2</b><span>Open the <b>INFRA Wallet</b> app → tap the <Globe className="inline h-4 w-4 align-[-3px]" /> browser tab</span></li>
          <li><b>3</b><span>Paste the link and tap <b>Connect → INFRA Wallet</b></span></li>
        </ol>
        <div className="oia-link mono">{url.replace(/^https?:\/\//, "")}</div>
        <button className="btn btn-b w-full" onClick={copy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Link copied" : "Copy link"}
        </button>
        <a className="oia-get" href="https://infraworld.org/wallet" target="_blank" rel="noreferrer">
          Don’t have INFRA Wallet? Get it →
        </a>
      </div>
    </div>
  );
}
