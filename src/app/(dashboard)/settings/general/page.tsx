import GeneralSettings from "@/features/settings/components/GeneralSettings";

/**
 * `/settings/general` — workspace name and description. The `(dashboard)`
 * layout gates auth; the settings layout supplies the tabs.
 */
export default function GeneralSettingsPage() {
	return <GeneralSettings />;
}
