import AdminWorkspaceDetail from "@/features/admin/components/AdminWorkspaceDetail";

/** `/admin/workspaces/[workspaceId]` — one workspace, read-only. */
export default async function AdminWorkspacePage({
	params,
}: {
	params: Promise<{ workspaceId: string }>;
}) {
	const { workspaceId } = await params;
	return <AdminWorkspaceDetail workspaceId={workspaceId} />;
}
