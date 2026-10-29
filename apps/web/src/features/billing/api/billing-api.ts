import { api, inWorkspace } from "@/lib/axios";

import type { ApiResponse } from "@/types/api";

import type { Billing, BillingRedirect } from "../types/billing-types";

/**
 * Billing API layer: `/billing`, scoped to the workspace by header. Reading is
 * open to every member; checkout and the portal need `billing:manage` (the
 * owner). Both return a Stripe-hosted URL to send the browser to — card
 * details never pass through TaskForge.
 */

export async function getBilling(
	workspaceId: string,
): Promise<ApiResponse<Billing>> {
	return api.get<Billing>("/billing", inWorkspace(workspaceId));
}

/** Starts a Pro checkout for the workspace; 409 if it is already paid. */
export async function startCheckout(
	workspaceId: string,
): Promise<ApiResponse<BillingRedirect>> {
	return api.post<BillingRedirect>(
		"/billing/checkout",
		undefined,
		inWorkspace(workspaceId),
	);
}

/** Opens Stripe's portal: card, invoices, cancel. */
export async function openPortal(
	workspaceId: string,
): Promise<ApiResponse<BillingRedirect>> {
	return api.post<BillingRedirect>(
		"/billing/portal",
		undefined,
		inWorkspace(workspaceId),
	);
}
