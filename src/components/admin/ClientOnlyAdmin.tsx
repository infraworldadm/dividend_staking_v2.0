"use client";

import dynamic from "next/dynamic";

const AdminPage = dynamic(() => import("@/components/admin/AdminPage").then((m) => m.AdminPage), { ssr: false });

export function ClientOnlyAdmin() {
  return <AdminPage />;
}
