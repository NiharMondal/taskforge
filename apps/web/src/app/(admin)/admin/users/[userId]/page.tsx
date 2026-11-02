import AdminUserDetail from "@/features/admin/components/AdminUserDetail";

/** `/admin/users/[userId]` — one account, read-only. */
export default async function AdminUserPage({
	params,
}: {
	params: Promise<{ userId: string }>;
}) {
	const { userId } = await params;
	return <AdminUserDetail userId={userId} />;
}
