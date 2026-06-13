import { api } from "@/lib/axios";

import type { ApiResponse } from "@/types/api";

import type { Workspace } from "../types/workspace-types";

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
 * can switch into. See AI_GUIDE → "Backend endpoint": `GET /workspaces`.
 */
export async function getWorkspaces(): Promise<ApiResponse<Workspace[]>> {
  return api.get<Workspace[]>("/workspaces");
}

/**
 * NOTE: switching workspaces is NOT a backend call. The active tenant is sent
 * on every request via the `x-workspace-id` header (see `lib/active-workspace`
 * and the axios request interceptor), so the switch is purely a client-side
 * change of which id we send. There is no `POST /workspaces/switch` route in
 * the documented contract, and none is required.
 */
