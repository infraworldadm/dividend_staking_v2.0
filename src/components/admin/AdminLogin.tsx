"use client";

/**
 * @file Username/password form for the admin console; posts to /api/admin/login.
 */
import { useState } from "react";
import { ArrowRight, Lock } from "lucide-react";

/** Username + password form for the admin console. */
export function AdminLogin({ configured }: { configured: boolean }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (r.ok) {
        window.location.href = "/admin";
        return;
      }
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      setError(j.error || "Login failed.");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="wrap grid min-h-[80vh] place-items-center py-10">
      <form onSubmit={submit} className="tile w-full max-w-[380px] !gap-3.5">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Logo/infra-logo-light.svg" alt="INFRA" className="brand-logo h-[22px] w-auto" />
          <span className="lbl">/ Admin</span>
        </div>
        <h1 className="text-[1.4rem]">Admin login</h1>
        {!configured ? (
          <p className="note">
            Admin login is not configured yet. Set <b>ADMIN_USERS</b> and <b>ADMIN_SESSION_SECRET</b> in the hosting
            environment, then redeploy.
          </p>
        ) : null}
        <label className="grid gap-1.5 text-[0.84rem] text-[var(--t2)]">
          Username
          <div className="field !py-2">
            <input
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="!text-[1rem] !font-medium"
              required
            />
          </div>
        </label>
        <label className="grid gap-1.5 text-[0.84rem] text-[var(--t2)]">
          Password
          <div className="field !py-2">
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="!text-[1rem] !font-medium"
              required
            />
            <Lock className="h-4 w-4 text-[var(--t3)]" />
          </div>
        </label>
        <button className="btn btn-k w-full" disabled={busy || !configured}>
          {busy ? "Signing in…" : "Sign in"} {!busy ? <ArrowRight /> : null}
        </button>
        {error ? <p className="err text-center">{error}</p> : null}
        <p className="text-[0.74rem] text-[var(--t3)]">
          Viewing and running the monthly routine. Owner-only on-chain actions still require the owner wallet to sign.
        </p>
      </form>
    </main>
  );
}
