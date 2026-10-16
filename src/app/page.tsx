/**
 * @file Home route (`/`) — renders the staking app client-side only (wallet state is browser-only).
 */
import { ClientOnlyStakingPage } from "@/components/staking/ClientOnlyStakingPage";

export default function Home() {
  return <ClientOnlyStakingPage />;
}
