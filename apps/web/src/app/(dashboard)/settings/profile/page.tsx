import ProfileSettings from "@/features/settings/components/ProfileSettings";

/**
 * `/settings/profile` — the signed-in user's name and avatar. The `(dashboard)`
 * layout gates auth; the settings layout supplies the tabs.
 */
export default function ProfileSettingsPage() {
	return <ProfileSettings />;
}
