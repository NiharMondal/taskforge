import { Spinner } from "@heroui/react";

/** Suspense fallback shown inside the dashboard shell while a page streams in. */
export default function DashboardLoading() {
	return (
		<div
			role="status"
			className="flex items-center justify-center gap-2 py-24 text-muted"
		>
			<Spinner size="sm" />
			Loading…
		</div>
	);
}
