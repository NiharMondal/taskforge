import { useMutation, useQuery } from "@tanstack/react-query";

import { getBilling, openPortal, startCheckout } from "../api/billing-api";

export const billingKeys = {
	detail: (workspaceId: string) => ["billing", workspaceId] as const,
};

/**
 * The workspace's plan, limits and usage. `refetchInterval` polls while the
 * page waits for Stripe's webhook after a checkout.
 */
export function useBilling(
	workspaceId: string,
	{ refetchInterval }: { refetchInterval?: number | false } = {},
) {
	return useQuery({
		queryKey: billingKeys.detail(workspaceId),
		queryFn: async () => (await getBilling(workspaceId)).data,
		enabled: !!workspaceId,
		refetchInterval,
	});
}

/**
 * Both mutations hand back a Stripe URL; the caller sends the browser there.
 * Nothing is invalidated: the plan only changes when the webhook lands, which
 * the billing page polls for on the way back.
 */
export function useStartCheckout(workspaceId: string) {
	return useMutation({
		mutationFn: async () => (await startCheckout(workspaceId)).data,
	});
}

export function useOpenPortal(workspaceId: string) {
	return useMutation({
		mutationFn: async () => (await openPortal(workspaceId)).data,
	});
}
