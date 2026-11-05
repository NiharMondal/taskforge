import type { Metadata } from "next";
import AdminUserDetail from "@/features/admin/components/AdminUserDetail";

export const metadata: Metadata = { title: "User" };

/** `/admin/users/[userId]` — one account, read-only. */
export default async function AdminUserPage({
	params,
}: {
	params: Promise<{ userId: string }>;
}) {
	const { userId } = await params;
	return <AdminUserDetail userId={userId} />;
}
