"use client";

import { Pagination, Spinner } from "@heroui/react";
import type { PaginationMeta } from "@taskforge/shared";
import { Lock, SearchX } from "lucide-react";

import BackButton from "@/components/ui/back-button";
import ErrorAlert from "@/components/ui/error-alert";
import { ApiError, getApiErrorMessage } from "@/lib/api-error";

export function AdminLoading() {
	return (
		<div className="flex items-center justify-center py-12">
			<Spinner />
		</div>
	);
}

/**
 * A failed admin query: a 403 means the viewer's platform role was taken away
 * since the page loaded, a 404 that the row is gone; anything else can be
 * retried.
 */
export function AdminQueryError({
	error,
	onRetry,
	what,
	backHref,
	backLabel,
}: {
	error: unknown;
	onRetry: () => void;
	/** "workspace", "user", … */
	what: string;
	backHref?: string;
	backLabel?: string;
}) {
	if (error instanceof ApiError && error.status === 403) {
		return (
			<Notice
				icon={<Lock className="size-5 text-muted" aria-hidden />}
				title="You no longer have platform access"
				text="Your platform role was removed. Reload to leave the admin console."
			/>
		);
	}
	if (error instanceof ApiError && error.status === 404) {
		return (
			<div className="flex flex-col gap-4">
				{backHref && backLabel && (
					<BackButton href={backHref} label={backLabel} />
				)}
				<Notice
					icon={<SearchX className="size-5 text-muted" aria-hidden />}
					title={`No such ${what}`}
					text={`It may have been deleted. Search the list for the ${what} instead.`}
				/>
			</div>
		);
	}
	return (
		<ErrorAlert
			title={`Couldn’t load the ${what}`}
			description={getApiErrorMessage(error, "Please try again.")}
			onRetry={onRetry}
		/>
	);
}

function Notice({
	icon,
	title,
	text,
}: {
	icon: React.ReactNode;
	title: string;
	text: string;
}) {
	return (
		<div className="flex flex-col items-center gap-2 py-12 text-center">
			{icon}
			<p className="text-sm font-medium">{title}</p>
			<p className="max-w-sm text-xs text-muted">{text}</p>
		</div>
	);
}

/** Previous/Next for an admin list, from the API's `metaData`. */
export function AdminPager({
	meta,
	page,
	onPage,
	isFetching,
	noun,
}: {
	meta: PaginationMeta | undefined;
	page: number;
	onPage: (page: number) => void;
	/** Disables paging while the next page is still loading. */
	isFetching: boolean;
	/** What the list holds, e.g. `["workspace", "workspaces"]`. */
	noun: [singular: string, plural: string];
}) {
	if (!meta || (meta.totalPages <= 1 && page <= 1)) return null;
	return (
		<Pagination size="sm" aria-label={`${noun[1]} pages`}>
			<Pagination.Summary>
				Page {meta.currentPage} of {Math.max(meta.totalPages, 1)} ·{" "}
				{meta.totalData} {meta.totalData === 1 ? noun[0] : noun[1]}
			</Pagination.Summary>
			<Pagination.Content>
				<Pagination.Item>
					<Pagination.Previous
						isDisabled={page <= 1 || isFetching}
						onPress={() => onPage(Math.max(1, page - 1))}
					>
						<Pagination.PreviousIcon />
						Previous
					</Pagination.Previous>
				</Pagination.Item>
				<Pagination.Item>
					<Pagination.Next
						isDisabled={!meta.hasNextPage || isFetching}
						onPress={() => onPage(page + 1)}
					>
						Next
						<Pagination.NextIcon />
					</Pagination.Next>
				</Pagination.Item>
			</Pagination.Content>
		</Pagination>
	);
}

/** A labelled value on a detail page. */
export function DetailItem({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex min-w-0 flex-col gap-0.5">
			<dt className="text-xs text-muted">{label}</dt>
			<dd className="min-w-0 text-sm break-words">{children}</dd>
		</div>
	);
}

/** An id, in monospace, selectable as a whole. */
export function MonoId({ id }: { id: string }) {
	return (
		<span className="font-mono text-xs break-all select-all text-muted">
			{id}
		</span>
	);
}
