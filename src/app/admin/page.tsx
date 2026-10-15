import type { Metadata } from "next";
import { ClientOnlyAdmin } from "@/components/admin/ClientOnlyAdmin";

export const metadata: Metadata = { title: "INFRA Staking — Admin", robots: { index: false } };

export default function AdminRoute() {
  return <ClientOnlyAdmin />;
}
