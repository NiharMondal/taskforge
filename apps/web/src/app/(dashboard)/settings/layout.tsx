import type { ReactNode } from "react";

import SettingsNav from "@/features/settings/components/SettingsNav";

/**
 * Settings shell shared across every `/settings/*` sub-route: the header and
 * tab navigation render once here, and the active section fills in as
 * `children`. New sections only need a `SETTINGS_TABS` entry + a sub-page.
 */
export default function SettingsLayout({
	children,
}: {
	children: ReactNode;
}) {
	return (
		<div className="flex flex-col gap-8">
			<SettingsNav />
			{children}
		</div>
	);
}
