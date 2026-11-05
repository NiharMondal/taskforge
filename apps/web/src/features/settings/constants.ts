import {
	CreditCard,
	ScrollText,
	ShieldCheck,
	SlidersHorizontal,
	Tag,
	User,
	Users,
	type LucideIcon,
} from "lucide-react";

import type { Permissions } from "@/features/memberships/lib/permissions";

/** A single settings sub-section, rendered as a tab linking to its sub-route. */
export interface SettingsTab {
	href: string;
	label: string;
	icon: LucideIcon;
	/**
	 * The permission flag the tab needs; without it the tab is hidden (the page
	 * itself still explains a missing permission to a deep link).
	 */
	requires?: keyof {
		[K in keyof Permissions as Permissions[K] extends boolean ? K : never]: true;
	};
}

/**
 * Settings sub-sections. Each is a real route under `/settings/<page>` so the
 * "tabs" are navigable, deep-linkable, and trivially extended — add an entry
 * here plus a `settings/<page>/page.tsx` and it shows up in the nav.
 */
export const SETTINGS_TABS: SettingsTab[] = [
	{ href: "/settings/members", label: "Members", icon: Users },
	{ href: "/settings/roles", label: "Roles", icon: ShieldCheck },
	{ href: "/settings/general", label: "General", icon: SlidersHorizontal },
	{ href: "/settings/labels", label: "Labels", icon: Tag },
	{ href: "/settings/billing", label: "Billing", icon: CreditCard },
	{
		href: "/settings/audit-log",
		label: "Audit log",
		icon: ScrollText,
		requires: "canReadAuditLog",
	},
	{ href: "/settings/profile", label: "Profile", icon: User },
];

/** The section users land on when visiting `/settings` directly. */
export const DEFAULT_SETTINGS_TAB = SETTINGS_TABS[0].href;
