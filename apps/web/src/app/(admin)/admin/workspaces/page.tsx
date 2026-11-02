import AdminWorkspaceList from "@/features/admin/components/AdminWorkspaceList";
import { parseAdminListParams } from "@/features/admin/lib/list-params";

/**
 * `/admin/workspaces?search=&plan=&page=` — every workspace. The list's state
 * is the URL, read here and handed to the client list.
 */
export default async function AdminWorkspacesPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	return <AdminWorkspaceList params={parseAdminListParams(await searchParams)} />;
}
