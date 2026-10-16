/**
 * @file Admin login route (`/admin/login`). Shows a notice when ADMIN_USERS / ADMIN_SESSION_SECRET are not configured.
 */
import type { Metadata } from "next";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { isAdminLoginConfigured } from "@/lib/adminAuth";

export const metadata: Metadata = { title: "Admin login", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function AdminLoginRoute() {
  return <AdminLogin configured={isAdminLoginConfigured()} />;
}
