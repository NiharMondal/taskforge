import { notFound, redirect } from "next/navigation";

import AdminShell from "@/features/admin/components/AdminShell";
import { fetchPlatformRole } from "@/features/admin/lib/fetch-platform-role";
import { auth } from "@/lib/auth";

/**
 * Server layout for the platform admin console (`spec/admin.md`). Outside
 * `(dashboard)` on purpose: that group wraps everything in a workspace, and
 * this data belongs to none.
 *
 * Anyone without a platform role gets a plain 404, so the console doesn't
 * advertise itself. That is a UX gate only — the backend's
 * PlatformRoleGuard checks the role (from the database) on every `/admin`
 * request.
 */
export default async function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await auth();
	if (!session || session.error) redirect("/login");

	const platformRole = await fetchPlatformRole(session.accessToken);
	if (!platformRole) notFound();

	return <AdminShell platformRole={platformRole}>{children}</AdminShell>;
}
