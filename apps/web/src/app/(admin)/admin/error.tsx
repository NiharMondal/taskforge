"use client";

import ErrorFallback from "@/components/ui/error-fallback";

/**
 * Error boundary for admin pages. It sits below the admin layout, so the
 * console's header and tabs stay up.
 */
export default function AdminError({
	error,
	unstable_retry,
}: {
	error: Error & { digest?: string };
	unstable_retry: () => void;
}) {
	return <ErrorFallback error={error} onRetry={unstable_retry} />;
}
