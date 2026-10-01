import { api } from "@/lib/axios";

import type { ApiResponse } from "@/types/api";

import type {
  AcceptInvitationResult,
  Invitation,
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
export async function getInvitations(): Promise<ApiResponse<Invitation[]>> {
  return api.get<Invitation[]>("/invitations");
}

export async function createInvitation(body: {
  email: string;
}): Promise<ApiResponse<Invitation>> {
  return api.post<Invitation>("/invitations", body);
}

export async function acceptInvitation(body: {
  token: string;
}): Promise<ApiResponse<AcceptInvitationResult>> {
  return api.post<AcceptInvitationResult>("/invitations/accept", body);
}
