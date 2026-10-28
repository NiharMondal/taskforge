import { api, inWorkspace } from "@/lib/axios";

import type { ApiResponse } from "@/types/api";

import type { TInviteFormValues } from "../schema/invitation-schema";
import type {
  AcceptInvitationResult,
  Invitation,
  InvitationPreview,
} from "../types/invitation-types";

/**
 * Invitation API layer. All invitation network calls belong here.
 *
 * Every function returns the full `ApiResponse` envelope (via `api` in
 * `lib/axios`); hooks unwrap `.data` where only the payload matters.
 *
 * `GET /invitations` and `POST /invitations` are scoped to the *active*
 * workspace via the `x-workspace-id` header — no id is passed in the route.
 * `POST /invitations/accept` resolves the workspace from the token itself.
 */
export async function getInvitations(
  workspaceId: string,
): Promise<ApiResponse<Invitation[]>> {
  return api.get<Invitation[]>("/invitations", inWorkspace(workspaceId));
}

export async function createInvitation(
  workspaceId: string,
  body: TInviteFormValues,
): Promise<ApiResponse<Invitation>> {
  return api.post<Invitation>("/invitations", body, inWorkspace(workspaceId));
}

/** Public: look up a token before accepting it (no workspace header needed). */
export async function validateInvitation(
  token: string,
): Promise<ApiResponse<InvitationPreview>> {
  return api.get<InvitationPreview>("/invitations/validate", {
    params: { token },
  });
}

export async function acceptInvitation(body: {
  token: string;
}): Promise<ApiResponse<AcceptInvitationResult>> {
  return api.post<AcceptInvitationResult>("/invitations/accept", body);
}

/** Revoke a pending invitation (`DELETE /invitations/:id`); its link stops working. */
export async function revokeInvitation(
  workspaceId: string,
  invitationId: string,
): Promise<ApiResponse<Invitation>> {
  return api.delete<Invitation>(
    `/invitations/${invitationId}`,
    inWorkspace(workspaceId),
  );
}
