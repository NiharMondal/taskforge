"use client";

import { useRouter } from "next/navigation";

import { adminListQueryString, type AdminListParams } from "../lib/list-params";

/**
 * Moves an admin list to new `?search=&plan=&page=` by changing the URL; the
 * server page reads it back and re-renders the list with it. A new search
 * replaces the history entry (no entry per keystroke); paging and filtering
 * push one, so "back" steps through them.
 */
export function useAdminListNavigation(basePath: string) {
	const router = useRouter();
	return (params: AdminListParams, { replace = false } = {}) => {
		const href = `${basePath}${adminListQueryString(params)}`;
		if (replace) router.replace(href, { scroll: false });
		else router.push(href, { scroll: false });
	};
}
