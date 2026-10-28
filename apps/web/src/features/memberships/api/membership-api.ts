import { api, inWorkspace } from "@/lib/axios";

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
 * The per-member routes are keyed by `userId` (`/memberships/:userId`, see
 * apps/backend/src/modules/memberships/membership.controller.ts); the
 * workspace stays implicit in the header.
 */
export async function getMemberships(
  workspaceId: string,
): Promise<ApiResponse<Member[]>> {
  return api.get<Member[]>("/memberships", inWorkspace(workspaceId));
}

/** Change a member's role within the active workspace (`PATCH /memberships/:userId`). */
export async function updateMembership(
  workspaceId: string,
  userId: string,
  dto: UpdateMembershipDto,
): Promise<ApiResponse<Member>> {
  return api.patch<Member>(
    `/memberships/${userId}`,
    dto,
    inWorkspace(workspaceId),
  );
}

/** Remove a member from the active workspace (`DELETE /memberships/:userId`). */
export async function removeMembership(
  workspaceId: string,
  userId: string,
): Promise<ApiResponse<Member>> {
  return api.delete<Member>(`/memberships/${userId}`, inWorkspace(workspaceId));
}

/**
 * Hand the workspace to another member (`POST /memberships/transfer-ownership`,
 * OWNER only): they become OWNER and the caller becomes ADMIN.
 */
export async function transferOwnership(
  workspaceId: string,
  userId: string,
): Promise<ApiResponse<Member>> {
  return api.post<Member>(
    "/memberships/transfer-ownership",
    { userId },
    inWorkspace(workspaceId),
  );
}

/**
 * Leave the workspace yourself (`DELETE /memberships/me`). Refused for the
 * OWNER and for your only workspace.
 */
export async function leaveWorkspace(
  workspaceId: string,
): Promise<ApiResponse<Member>> {
  return api.delete<Member>("/memberships/me", inWorkspace(workspaceId));
}
