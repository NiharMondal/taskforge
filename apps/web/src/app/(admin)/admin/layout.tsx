import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import AdminShell from "@/features/admin/components/AdminShell";
import { fetchPlatformViewer } from "@/features/admin/lib/fetch-platform-viewer";
import { auth } from "@/lib/auth";

/** "Users · Admin · TaskForge"; the overview is "Admin · TaskForge". */
export const metadata: Metadata = {
	title: { default: "Admin", template: "%s · Admin · TaskForge" },
};

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

	const viewer = await fetchPlatformViewer(session.accessToken);
	if (!viewer) notFound();

	return <AdminShell viewer={viewer}>{children}</AdminShell>;
}
