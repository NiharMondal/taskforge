import { Suspense } from "react";

import BillingSettings from "@/features/billing/components/BillingSettings";

/**
 * `/settings/billing` — the workspace's plan, and where Stripe sends the
 * owner back after checkout (`?checkout=success|canceled`). The `(dashboard)`
 * layout gates auth; the settings layout supplies the tabs.
 */
export default function BillingSettingsPage() {
	return (
		// useSearchParams() in BillingSettings requires a Suspense boundary.
		<Suspense fallback={null}>
			<BillingSettings />
		</Suspense>
	);
}
