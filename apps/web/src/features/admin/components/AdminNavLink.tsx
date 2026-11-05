"use client";

import { ShieldCheck } from "lucide-react";

import SidebarItem from "@/components/layout/SidebarItem";
import { useCurrentUserId } from "@/features/auth/hooks/use-current-user-id";
import { useCurrentUser } from "@/features/profile/hooks/use-profile";

/**
 * The sidebar's "Admin" entry, shown only to platform staff (`platformRole`
 * from `GET /users/me`, the profile query the settings page already uses).
 * Hiding it is UX; the admin layout and the backend both check the role.
 */
export default function AdminNavLink() {
	const userId = useCurrentUserId();
	const { data: user } = useCurrentUser(userId);

	if (!user?.platformRole) return null;
	return <SidebarItem href="/admin" label="Admin" icon={ShieldCheck} />;
}
