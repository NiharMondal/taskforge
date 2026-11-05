import { api, inWorkspace } from "@/lib/axios";
import { getAllPages } from "@/lib/get-all-pages";

import type { ApiResponse } from "@/types/api";

import type { Workspace } from "../types/workspace-types";
import type { TWorkspaceFormValues } from "../schema/workspace-schema";

/**
 * Workspace API layer. All workspace network calls belong here (AI_GUIDE:
 * never call axios/fetch directly from components).
 *
 * Every function returns the full `ApiResponse` envelope (via `api` in
 * `lib/axios`); hooks unwrap `.data` where only the payload matters.
 */

/**
 * List the workspaces the current user is a member of.
 *
 * The backend derives the user from the bearer token (the token has no
 * workspace), so this needs no parameters — it returns every tenant the caller
 * can switch into, reading every page. See AI_GUIDE → "Backend endpoint":
 * `GET /workspaces`.
 */
export async function getWorkspaces(): Promise<ApiResponse<Workspace[]>> {
  return getAllPages<Workspace>("/workspaces");
}

/**
 * Create a workspace for the current user (`POST /workspaces`). The backend
 * makes the caller the OWNER via a new membership; no workspace header is
 * needed since the new tenant doesn't exist yet.
 */
export async function createWorkspace(
  dto: TWorkspaceFormValues,
): Promise<ApiResponse<Workspace>> {
  return api.post<Workspace>("/workspaces", dto);
}

/**
 * Update a workspace's editable fields (`PATCH /workspaces/:workspaceId`).
 * Used by the settings → General tab to rename / re-describe the active tenant.
 */
export async function updateWorkspace(
  workspaceId: string,
  dto: TWorkspaceFormValues,
): Promise<ApiResponse<Workspace>> {
  // The backend 403s a header that disagrees with the path, so send the one
  // being edited rather than whichever workspace is active.
  return api.patch<Workspace>(
    `/workspaces/${workspaceId}`,
    dto,
    inWorkspace(workspaceId),
  );
}

/**
 * NOTE: switching workspaces is NOT a backend call. The active tenant is sent
 * on every request via the `x-workspace-id` header (see `lib/active-workspace`
 * and the axios request interceptor), so the switch is purely a client-side
 * change of which id we send. There is no `POST /workspaces/switch` route in
 * the documented contract, and none is required.
 */

/**
 * Delete a workspace with everything in it (`DELETE /workspaces/:workspaceId`).
 * OWNER only. Pinned to the workspace being deleted, like `updateWorkspace`.
 */
export async function deleteWorkspace(
  workspaceId: string,
): Promise<ApiResponse<Workspace>> {
  return api.delete<Workspace>(
    `/workspaces/${workspaceId}`,
    inWorkspace(workspaceId),
  );
}
