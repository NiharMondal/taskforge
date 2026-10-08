"use client";

import ErrorFallback from "@/components/ui/error-fallback";

/**
 * Error boundary for dashboard pages. An `error.tsx` doesn't wrap the layout in
 * its own segment, so the sidebar and header stay up and only the page area
 * shows the fallback — the user can still navigate away.
 */
export default function DashboardError({
	error,
	unstable_retry,
}: {
	error: Error & { digest?: string };
	unstable_retry: () => void;
}) {
	return <ErrorFallback error={error} onRetry={unstable_retry} />;
}
