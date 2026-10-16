/**
 * @file GET /api/admin/me — returns the logged-in operator's username (or null).
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, readSession } from "@/lib/adminAuth";

export const runtime = "edge";

export async function GET() {
  const user = await readSession((await cookies()).get(SESSION_COOKIE)?.value);
  return NextResponse.json({ user }, { headers: { "Cache-Control": "no-store" } });
}
