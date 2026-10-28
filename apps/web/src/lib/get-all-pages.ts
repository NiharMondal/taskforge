import { MAX_PAGE_SIZE } from "@taskforge/shared";
import type { AxiosRequestConfig } from "axios";

import type { ApiResponse } from "@/types/api";

import { api } from "./axios";

/**
 * GET every page of a paginated list and return them as one list.
 *
 * The backend's list routes answer one page at a time (20 rows unless asked),
 * but pickers, id lookups and the workspace switcher need the whole list. This
 * walks the pages until `metaData.hasNextPage` is false. The returned envelope
 * is the last page's, with `data` replaced by the concatenation of every page.
 *
 * One request per 100 rows, serially — fine for lists that rarely pass a page.
 */
export async function getAllPages<T extends { id: string }>(
  url: string,
  config: AxiosRequestConfig = {},
): Promise<ApiResponse<T[]>> {
  const seen = new Set<string>();
  const rows: T[] = [];

  let page = 1;
  for (;;) {
    const res = await api.get<T[]>(url, {
      ...config,
      params: { ...config.params, page, limit: MAX_PAGE_SIZE },
    });

    // A write landing between page fetches shifts rows across the boundary,
    // so the same row can show up twice — keep the first copy.
    for (const row of res.data) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
    }

    // An empty page ends the walk even if `hasNextPage` lies, so a bad
    // response can't loop forever.
    if (!res.metaData?.hasNextPage || res.data.length === 0) {
      return { ...res, data: rows };
    }
    page += 1;
  }
}
