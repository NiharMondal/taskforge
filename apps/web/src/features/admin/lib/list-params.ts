import type { SubscriptionPlan } from "@taskforge/shared";

import { isSubscriptionPlan } from "../constants";

/** The longest search the backend accepts (`MAX_ADMIN_SEARCH_LENGTH`). */
const MAX_SEARCH_LENGTH = 200;

/** An admin list's state, kept in the URL so "back" from a detail page keeps it. */
export interface AdminListParams {
	search?: string;
	plan?: SubscriptionPlan;
	page: number;
}

type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) =>
	Array.isArray(value) ? value[0] : value;

/**
 * Read a list's `?search=&plan=&page=` from the page's `searchParams`.
 * Anything malformed falls back to the default rather than reaching the API
 * (which would 400).
 */
export function parseAdminListParams(raw: RawSearchParams): AdminListParams {
	const search = first(raw.search)?.trim().slice(0, MAX_SEARCH_LENGTH);
	const plan = first(raw.plan);
	const page = Number(first(raw.page));

	return {
		search: search || undefined,
		plan: isSubscriptionPlan(plan) ? plan : undefined,
		page: Number.isInteger(page) && page > 0 ? page : 1,
	};
}

/** The query string for `params`, leaving out defaults so URLs stay short. */
export function adminListQueryString(params: AdminListParams): string {
	const query = new URLSearchParams();
	if (params.search) query.set("search", params.search);
	if (params.plan) query.set("plan", params.plan);
	if (params.page > 1) query.set("page", String(params.page));
	const qs = query.toString();
	return qs ? `?${qs}` : "";
}
