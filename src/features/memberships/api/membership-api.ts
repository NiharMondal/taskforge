import { api } from "@/lib/axios";

import type { ApiResponse } from "@/types/api";

import type { Member } from "../types/membership-types";

/**
 * Membership API layer. All membership network calls belong here.
 *
 * Every function returns the full `ApiResponse` envelope (via `api` in
 * `lib/axios`); hooks unwrap `.data` where only the payload matters.
 *
 * `GET /memberships` returns every member of the *active* workspace — the
 * workspace is resolved from the `x-workspace-id` header (AI_GUIDE → "Backend
 * endpoint": "@workspaceId from header"), so no id is passed in the route.
 */
export async function getMemberships(): Promise<ApiResponse<Member[]>> {
  return api.get<Member[]>("/memberships");
}
