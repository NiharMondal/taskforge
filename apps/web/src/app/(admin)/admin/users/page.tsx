import type { Metadata } from "next";
import AdminUserList from "@/features/admin/components/AdminUserList";
import { parseAdminListParams } from "@/features/admin/lib/list-params";

export const metadata: Metadata = { title: "Users" };

/**
 * `/admin/users?search=&page=` — every account. The list's state is the URL,
 * read here and handed to the client list (`plan` doesn't apply to users).
 */
export default async function AdminUsersPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	const { search, page } = parseAdminListParams(await searchParams);
	return <AdminUserList params={{ search, page }} />;
}
