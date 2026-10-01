/**
 * Pluggable active-workspace source for the API client.
 *
 * Mirrors `auth-token.ts`: the HTTP layer (`axios.ts`) must NOT know *how* the
 * active workspace is chosen (React Context + localStorage, see
 * `features/workspace/context`). The workspace layer pushes the current id here
 * and the request interceptor reads it to set the `x-workspace-id` header on
 * every request.
 *
 * Why this matters (AI_GUIDE → "MOST IMPORTANT"): the access token carries only
 * the user, never a workspace. A user belongs to many workspaces, so the active
 * tenant is communicated per-request via this header — that header *is* the
 * "workspace switch".
 */
let activeWorkspaceId: string | null = null;

/** Set the workspace id sent on subsequent requests (or null to clear it). */
export function setActiveWorkspaceId(id: string | null): void {
  activeWorkspaceId = id;
}

/** The workspace id to attach as `x-workspace-id`, or null when none is active. */
export function getActiveWorkspaceId(): string | null {
  return activeWorkspaceId;
}
