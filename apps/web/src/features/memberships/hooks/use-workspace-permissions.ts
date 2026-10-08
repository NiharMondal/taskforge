"use client";

import { useEffect, useMemo } from "react";

import { useSession } from "next-auth/react";

import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { getUserIdFromAccessToken } from "@/lib/auth-token";

import {
	getPermissions,
	UNRESTRICTED_PERMISSIONS,
	type Permissions,
} from "../lib/permissions";
import { useMemberships } from "./use-memberships";

/**
 * The signed-in user's permissions in the active workspace, derived from the
 * membership roster (the JWT carries no role — the tenant is the
 * `x-workspace-id` header). Shares the roster's cache entry, so calling this
 * from several components costs no extra requests.
 *
 * "Which roster row is me" is taken from the backend access token's `sub` (what
 * the backend authorizes as), falling back to the session's own `user.id`.
 *
 * Flags are all `false` while loading. If the role still can't be determined
 * afterwards, the controls are shown rather than hidden (see
 * {@link UNRESTRICTED_PERMISSIONS}) and `isRoleKnown` is `false`.
 */
export function useWorkspacePermissions(): Permissions & {
	isLoading: boolean;
	isRoleKnown: boolean;
} {
	const { activeWorkspaceId, isLoading: isWorkspacesLoading } = useWorkspace();
	const { data: session, status } = useSession();
	const {
		data: members,
		isLoading: isRosterLoading,
		isError: isRosterError,
	} = useMemberships(activeWorkspaceId ?? "");

	const tokenUserId = getUserIdFromAccessToken(session?.accessToken);
	const sessionUserId = session?.user?.id;
	const userId = tokenUserId ?? sessionUserId;

	const role = members?.find((m) => m.userId === userId)?.role;
	// The roster query is idle until a workspace is active, so the workspace
	// list itself must count as loading or this would read as "unresolved".
	const isLoading =
		status === "loading" ||
		isWorkspacesLoading ||
		(!!activeWorkspaceId && isRosterLoading);
	const isUnresolved = !isLoading && !role;

	useEffect(() => {
		if (!isUnresolved || process.env.NODE_ENV === "production") return;
		console.warn(
			"[permissions] Couldn't resolve your role in this workspace, so every control is shown and the backend will enforce. Check that the ids below appear on the roster.",
			{
				workspaceId: activeWorkspaceId,
				tokenUserId,
				sessionUserId,
				rosterUserIds: members?.map((m) => m.userId),
				rosterFailed: isRosterError,
			},
		);
	}, [
		isUnresolved,
		activeWorkspaceId,
		tokenUserId,
		sessionUserId,
		members,
		isRosterError,
	]);

	return useMemo(() => {
		const base = role
			? getPermissions(role)
			: isUnresolved
				? UNRESTRICTED_PERMISSIONS
				: getPermissions(undefined);
		return { ...base, isLoading, isRoleKnown: !!role };
	}, [role, isUnresolved, isLoading]);
}
