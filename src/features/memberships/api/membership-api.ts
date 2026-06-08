import { apiClient } from "@/lib/axios";

import type { ApiResponse } from "@/types/api";

import type { Member } from "../types/membership-types";

/**
 * Membership API layer. All membership network calls belong here.
 *
 * `GET /memberships` returns every member of the *active* workspace — the
 * workspace is resolved from the `x-workspace-id` header (AI_GUIDE → "Backend
 * endpoint": "@workspaceId from header"), so no id is passed in the route.
 */
export async function getMemberships(): Promise<Member[]> {
  const { data } = await apiClient.get<ApiResponse<Member[]>>("/memberships");
  return data.data;
}
