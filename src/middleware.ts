/**
 * @file Edge middleware guarding /admin: redirects to /admin/login unless a valid signed session cookie is present.
 */
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSession } from "@/lib/adminAuth";

/** Protects /admin: anyone without a valid admin session is sent to /admin/login. */
export async function middleware(req: NextRequest) {
  const user = await readSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  const res = NextResponse.next();
  res.headers.set("x-admin-user", user);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export const config = { matcher: ["/admin"] };
