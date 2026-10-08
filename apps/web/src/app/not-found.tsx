import Link from "next/link";

/** 404 for unmatched URLs and `notFound()` calls. */
export default function NotFound() {
	return (
		<main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
			<p className="text-5xl font-semibold text-muted">404</p>
			<div className="flex flex-col gap-1">
				<h1 className="font-medium">Page not found</h1>
				<p className="text-sm text-muted">
					The page you’re looking for doesn’t exist or has moved.
				</p>
			</div>
			<Link
				href="/dashboard"
				className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-secondary"
			>
				Back to dashboard
			</Link>
		</main>
	);
}
