import { SlidersHorizontal, User, Users, type LucideIcon } from "lucide-react";

/** A single settings sub-section, rendered as a tab linking to its sub-route. */
export interface SettingsTab {
	href: string;
	label: string;
	icon: LucideIcon;
}

/**
 * Settings sub-sections. Each is a real route under `/settings/<page>` so the
 * "tabs" are navigable, deep-linkable, and trivially extended — add an entry
 * here plus a `settings/<page>/page.tsx` and it shows up in the nav.
 */
export const SETTINGS_TABS: SettingsTab[] = [
	{ href: "/settings/members", label: "Members", icon: Users },
	{ href: "/settings/general", label: "General", icon: SlidersHorizontal },
	{ href: "/settings/profile", label: "Profile", icon: User },
];

/** The section users land on when visiting `/settings` directly. */
export const DEFAULT_SETTINGS_TAB = SETTINGS_TABS[0].href;
