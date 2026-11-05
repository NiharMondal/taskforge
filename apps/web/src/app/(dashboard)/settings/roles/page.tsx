import RolesSettings from "@/features/settings/components/RolesSettings";

/**
 * `/settings/roles` — the workspace's roles and what each grants. The
 * `(dashboard)` layout gates auth; the settings layout supplies the tabs.
 */
export default function RolesSettingsPage() {
	return <RolesSettings />;
}
