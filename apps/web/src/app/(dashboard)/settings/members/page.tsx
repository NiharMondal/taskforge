import MembersSettings from "@/features/settings/components/MembersSettings";

/**
 * `/settings/members` — workspace roster, role management, and invitations.
 * The `(dashboard)` layout gates auth; the settings layout supplies the tabs.
 */
export default function MembersSettingsPage() {
	return <MembersSettings />;
}
