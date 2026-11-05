import type { Metadata } from "next";
import AdminWorkspaceDetail from "@/features/admin/components/AdminWorkspaceDetail";

export const metadata: Metadata = { title: "Workspace" };

/** `/admin/workspaces/[workspaceId]` — one workspace, read-only. */
export default async function AdminWorkspacePage({
	params,
}: {
	params: Promise<{ workspaceId: string }>;
}) {
	const { workspaceId } = await params;
	return <AdminWorkspaceDetail workspaceId={workspaceId} />;
}
