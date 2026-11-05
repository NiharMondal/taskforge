import type { Metadata } from "next";
import DashboardOverview from "@/features/dashboard/components/DashboardOverview";
import { auth } from "@/lib/auth";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Dashboard landing content. The `(dashboard)` layout provides the shell
 * (sidebar, header, auth gate); this server page resolves the signed-in user
 * and hands the rest off to the client overview (which reads the active
 * workspace and its React Query data).
 */
export default async function DashboardPage() {
  const session = await auth();
  const userName =
    session?.user?.name ?? session?.user?.email ?? "there";

  return <DashboardOverview userName={userName} />;
}
