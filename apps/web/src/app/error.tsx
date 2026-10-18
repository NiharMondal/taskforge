"use client";

import ErrorFallback from "@/components/ui/error-fallback";

/**
 * Catch-all error boundary for everything under the root layout that has no
 * boundary of its own (auth pages, invitation accept, …). Next 16 hands the
 * boundary `unstable_retry` — it refetches and re-renders the segment — in
 * place of the older `reset`.
 */
export default function RootError({
	error,
	unstable_retry,
}: {
	error: Error & { digest?: string };
	unstable_retry: () => void;
}) {
	return (
		<main className="mx-auto flex min-h-dvh max-w-md items-center justify-center p-6">
			<ErrorFallback error={error} onRetry={unstable_retry} />
		</main>
	);
}
