import { auth } from "@/lib/auth";

/**
 * Dashboard landing content. The `(dashboard)` layout provides the shell
 * (sidebar, header, auth gate), so this page only renders content.
 */
export default async function DashboardPage() {
  const session = await auth();

  return (
    <div className="flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">
          Welcome back, {session?.user?.name ?? session?.user?.email}.
        </p>
      </header>

      <section className="rounded-lg border border-border bg-surface p-6">
        <p className="text-sm text-muted">
          Pick a workspace from the sidebar to get started. Projects and issues
          come next.
        </p>
      </section>
    </div>
  );
}
