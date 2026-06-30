import { redirect } from "next/navigation";

import AppLayout from "@/components/layout/AppLayout";
import { auth } from "@/lib/auth";

/**
 * Server layout for the authenticated dashboard. Runs the session gate once for
 * every route in the `(dashboard)` group (defense in depth alongside `proxy.ts`,
 * per spec/auth.md) and hands a minimal, serializable user to the client shell.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const user = {
    name: session.user?.name,
    email: session.user?.email,
    image: session.user?.image,
  };

  return <AppLayout user={user}>{children}</AppLayout>;
}
