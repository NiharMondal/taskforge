import { api } from "@/lib/axios";

import type { ApiResponse } from "@/types/api";

import type { Member, UpdateMembershipDto } from "../types/membership-types";

/**
 * Membership API layer. All membership network calls belong here.
 *
 * Every function returns the full `ApiResponse` envelope (via `api` in
 * `lib/axios`); hooks unwrap `.data` where only the payload matters.
 *
 * `GET /memberships` returns every member of the *active* workspace — the
 * workspace is resolved from the `x-workspace-id` header (AI_GUIDE → "Backend
 * endpoint": "@workspaceId from header"), so no id is passed in the route.
 * The per-member routes are keyed by `userId` (BACK_END_API → Memberships:
 * `:userId(GET, UPDATE, DELETE)`); the workspace stays implicit in the header.
 */
export async function getMemberships(): Promise<ApiResponse<Member[]>> {
  return api.get<Member[]>("/memberships");
}

/** Change a member's role within the active workspace (`PATCH /memberships/:userId`). */
export async function updateMembership(
  userId: string,
  dto: UpdateMembershipDto,
): Promise<ApiResponse<Member>> {
  return api.patch<Member>(`/memberships/${userId}`, dto);
}

/** Remove a member from the active workspace (`DELETE /memberships/:userId`). */
export async function removeMembership(
  userId: string,
): Promise<ApiResponse<Member>> {
  return api.delete<Member>(`/memberships/${userId}`);
}
