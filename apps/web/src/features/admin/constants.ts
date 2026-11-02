import type { ComponentProps } from "react";

import type { Chip } from "@heroui/react";
import {
	PLATFORM_ROLE_VALUES,
	SUBSCRIPTION_PLAN_VALUES,
	type SubscriptionPlan,
	type SubscriptionStatus,
} from "@taskforge/shared";

import type { PlatformRole, SignInProvider } from "./types/admin-types";

/** Rows per page of the admin lists. */
export const ADMIN_PAGE_SIZE = 25;

/** How long the search box waits after typing before it searches. */
export const ADMIN_SEARCH_DEBOUNCE_MS = 300;

export const PLATFORM_ROLE_LABELS: Record<PlatformRole, string> = {
	ADMIN: "Admin",
	SUPPORT: "Support",
};

export const PLATFORM_ROLE_DESCRIPTIONS: Record<PlatformRole, string> = {
	ADMIN: "Full platform access",
	SUPPORT: "Read-only platform access",
};

export const SIGN_IN_PROVIDER_LABELS: Record<SignInProvider, string> = {
	EMAIL: "Password",
	GOOGLE: "Google",
	FACEBOOK: "Facebook",
};

/** Whether a string from the URL names a platform role. */
export const isPlatformRole = (value: unknown): value is PlatformRole =>
	(PLATFORM_ROLE_VALUES as readonly unknown[]).includes(value);

/** Whether a string from the URL names a plan (the workspace list's filter). */
export const isSubscriptionPlan = (value: unknown): value is SubscriptionPlan =>
	(SUBSCRIPTION_PLAN_VALUES as readonly unknown[]).includes(value);

type ChipColor = NonNullable<ComponentProps<typeof Chip>["color"]>;

/** How each Stripe status reads at a glance: live is fine, at risk warns, ended is muted. */
export const SUBSCRIPTION_STATUS_COLOR: Record<SubscriptionStatus, ChipColor> = {
	ACTIVE: "success",
	TRIALING: "accent",
	PAST_DUE: "warning",
	UNPAID: "danger",
	CANCELED: "default",
	INCOMPLETE: "warning",
	INCOMPLETE_EXPIRED: "default",
	PAUSED: "default",
};
