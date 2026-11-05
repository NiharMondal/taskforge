import type { Metadata } from "next";
import RolesSettings from "@/features/settings/components/RolesSettings";

export const metadata: Metadata = { title: "Roles" };

/**
 * `/settings/roles` — the workspace's roles and what each grants. The
 * `(dashboard)` layout gates auth; the settings layout supplies the tabs.
 */
export default function RolesSettingsPage() {
	return <RolesSettings />;
}
