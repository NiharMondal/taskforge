/**
 * A Stripe object's page in Stripe's dashboard. Test-mode objects live under
 * `/test/`, and an id only exists in the mode it was made in — the backend
 * reports which one from its key (`stripeMode`). Unknown mode: no link.
 */
export function stripeDashboardUrl(
	kind: "customers" | "subscriptions",
	id: string,
	mode: "test" | "live" | null,
): string | null {
	if (!mode) return null;
	const prefix = mode === "test" ? "/test" : "";
	return `https://dashboard.stripe.com${prefix}/${kind}/${encodeURIComponent(id)}`;
}
