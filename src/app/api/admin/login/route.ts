/**
 * @file POST /api/admin/login — verifies operator credentials (env ADMIN_USERS) and sets a signed, httpOnly session cookie.
 */
import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_HOURS, checkCredentials, createSession, isAdminLoginConfigured } from "@/lib/adminAuth";

export const runtime = "edge";

export async function POST(req: Request) {
  if (!isAdminLoginConfigured()) {
    return NextResponse.json({ error: "Admin login is not configured on the server." }, { status: 503 });
  }
  let username = "";
  let password = "";
  try {
    const body = (await req.json()) as { username?: string; password?: string };
    username = String(body.username || "").trim();
    password = String(body.password || "");
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!(await checkCredentials(username, password))) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return NextResponse.json({ error: "Wrong username or password." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true, user: username });
  res.cookies.set(SESSION_COOKIE, await createSession(username), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  return res;
}
