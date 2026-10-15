/**
 * Admin console login (username + password) — Edge-compatible.
 *
 * Credentials come ONLY from server environment variables (set in Vercel):
 *   ADMIN_USERS          "alice:StrongPass1,bob:StrongPass2"  (one or more operators)
 *   ADMIN_SESSION_SECRET long random string used to sign the session cookie
 *
 * The session cookie is `username|expiry|hmac` (HMAC-SHA256), httpOnly + secure,
 * valid for SESSION_HOURS. Nothing secret is ever sent to the browser bundle.
 */
export const SESSION_COOKIE = "infra_admin_session";
export const SESSION_HOURS = 12;

const enc = new TextEncoder();

function users(): Map<string, string> {
  const map = new Map<string, string>();
  for (const pair of (process.env.ADMIN_USERS || "").split(",")) {
    const i = pair.indexOf(":");
    if (i > 0) map.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
  }
  return map;
}

export function isAdminLoginConfigured() {
  return users().size > 0 && (process.env.ADMIN_SESSION_SECRET || "").length >= 32;
}

async function hmac(data: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(process.env.ADMIN_SESSION_SECRET || ""),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string compare (via HMAC of both sides). */
async function safeEqual(a: string, b: string) {
  const [x, y] = await Promise.all([hmac(`cmp:${a}`), hmac(`cmp:${b}`)]);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.min(x.length, y.length); i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return diff === 0;
}

export async function checkCredentials(username: string, password: string) {
  if (!isAdminLoginConfigured()) return false;
  const expected = users().get(username);
  // always run a comparison so timing doesn't reveal whether the username exists
  const ok = await safeEqual(password, expected ?? `__none__${password}x`);
  return Boolean(expected) && ok;
}

export async function createSession(username: string) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_HOURS * 3600;
  const body = `${username}|${exp}`;
  return `${body}|${await hmac(body)}`;
}

/** Returns the username if the cookie value is a valid, unexpired session. */
export async function readSession(value?: string | null): Promise<string | null> {
  if (!value || !isAdminLoginConfigured()) return null;
  const parts = value.split("|");
  if (parts.length !== 3) return null;
  const [username, exp, sig] = parts;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return null;
  if (!users().has(username)) return null; // removed operators lose access immediately
  const ok = await safeEqual(sig, await hmac(`${username}|${exp}`));
  return ok ? username : null;
}
