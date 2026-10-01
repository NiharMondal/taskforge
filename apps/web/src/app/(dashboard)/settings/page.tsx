import { redirect } from "next/navigation";

import { DEFAULT_SETTINGS_TAB } from "@/features/settings/constants";

/**
 * `/settings` has no content of its own — it lands on the first tab. Sections
 * live at `/settings/<page>` so each is deep-linkable (see SETTINGS_TABS).
 */
export default function SettingsPage() {
	redirect(DEFAULT_SETTINGS_TAB);
}
