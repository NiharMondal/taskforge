"use client";

import { useEffect } from "react";

import { Button } from "@heroui/react";
import { TriangleAlert } from "lucide-react";

type Props = {
	error: Error & { digest?: string };
	onRetry: () => void;
};

/**
 * Body of a route-level `error.tsx`. It deliberately doesn't print
 * `error.message`: for server-rendered errors Next replaces it with a generic
 * string anyway, and for client errors it's rarely something to show a user.
 * The `digest` is the handle for finding the matching server log.
 */
export default function ErrorFallback({ error, onRetry }: Props) {
	useEffect(() => {
		console.error(error);
	}, [error]);

	return (
		<div
			role="alert"
			className="flex flex-col items-center justify-center gap-4 py-24 text-center"
		>
			<TriangleAlert className="h-12 w-12 text-danger/60" />
			<div className="flex flex-col gap-1">
				<p className="font-medium">Something went wrong</p>
				<p className="text-sm text-muted">
					An unexpected error occurred. Try again, and if it keeps
					happening, reload the page.
				</p>
				{error.digest && (
					<p className="text-xs text-muted">Reference: {error.digest}</p>
				)}
			</div>
			<Button type="button" variant="outline" onPress={onRetry}>
				Try again
			</Button>
		</div>
	);
}
