"use client";

/**
 * @file Loads the admin dashboard on the client only (wagmi/RainbowKit need `window`).
 */
import dynamic from "next/dynamic";

const AdminPage = dynamic(() => import("@/components/admin/AdminPage").then((m) => m.AdminPage), { ssr: false });

export function ClientOnlyAdmin() {
  return <AdminPage />;
}
