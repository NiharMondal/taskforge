import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { SignOutButton } from "@/features/auth/components/sign-out-button";

/**
 * Example protected page.
 *
 * Defense in depth: `proxy.ts` already redirects unauthenticated users, but we
 * also verify the session server-side here via `auth()` (spec/auth.md: the
 * proxy guard is optimistic; never rely on it alone).
 */
export default async function DashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Signed in as {session.user?.name ?? session.user?.email}
          </p>
        </div>
        <SignOutButton />
      </header>

      <section className="rounded-lg border border-border p-6">
        <p className="text-sm text-muted-foreground">
          You are authenticated. Workspace and project views come next.
        </p>
      </section>
    </main>
  );
}
