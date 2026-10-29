"use client";

import { toast } from "@heroui/react";
import { PLAN_LIMIT_ERROR_CODE, type PlanLimitKind } from "@taskforge/shared";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { ApiError, getApiErrorMessage } from "@/lib/api-error";

import type { Billing } from "../types/billing-types";

export const BILLING_PATH = "/settings/billing";

/**
 * Whether the API refused a write because of the workspace's plan: a 402
 * carrying `code: "PLAN_LIMIT"` ("upgrade needed"), as opposed to a 403 ("not
 * allowed").
 */
export function isPlanLimitError(
	error: unknown,
): error is ApiError & { data: { limit: PlanLimitKind } } {
	return (
		error instanceof ApiError &&
		error.status === 402 &&
		(error.data as { code?: unknown } | undefined)?.code ===
			PLAN_LIMIT_ERROR_CODE
	);
}

/**
 * A toast for a failed write: a plan limit gets an "Upgrade" button that
 * opens Settings → Billing, anything else the usual danger toast.
 */
export function useErrorToast() {
	const router = useRouter();

	return useCallback(
		(error: unknown, fallback: string) => {
			if (isPlanLimitError(error)) {
				toast.warning(error.message, {
					actionProps: {
						children: "Upgrade",
						onPress: () => router.push(BILLING_PATH),
					},
				});
				return;
			}
			toast.danger(getApiErrorMessage(error, fallback));
		},
		[router],
	);
}

/** Members plus live invitations against the plan's seat limit. */
export function seatUsage(billing: Billing) {
	const used = billing.usage.members + billing.usage.pendingInvitations;
	const limit = billing.limits.members;
	return { used, limit, isFull: limit !== null && used >= limit };
}
