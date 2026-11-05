"use client";

import { useEffect, useMemo } from "react";

import { useSession } from "next-auth/react";

import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { getUserIdFromAccessToken } from "@/lib/auth-token";

import {
	NO_PERMISSIONS,
	permissionsFrom,
	UNRESTRICTED_PERMISSIONS,
	type Permissions,
} from "../lib/permissions";
import { useMyMembership } from "./use-memberships";

/**
 * The signed-in user's permissions in the active workspace, from
 * `GET /memberships/me` — the backend resolves the role (built-in or custom)
 * into permission keys, so the web keeps no copy of the rules. Every caller
 * shares one cache entry (`membershipKeys.me`), so this costs one request per
 * workspace.
 *
 * Flags are all `false` while loading. If the membership still can't be read
 * afterwards, the controls are shown rather than hidden (see
 * {@link UNRESTRICTED_PERMISSIONS}) and `isRoleKnown` is `false`.
 *
 * `userId` is "me" for rules about your own rows (editing your own comments,
 * your own issues): the backend's answer, else the access token's `sub` (what
 * the backend authorizes as), else the session's id.
 */
export function useWorkspacePermissions(): Permissions & {
	isLoading: boolean;
	isRoleKnown: boolean;
} {
	const { activeWorkspaceId, isLoading: isWorkspacesLoading } = useWorkspace();
	const { data: session, status } = useSession();
	const {
		data: me,
		isLoading: isMeLoading,
		isError: isMeError,
	} = useMyMembership(activeWorkspaceId ?? "");

	const userId =
		me?.userId ??
		getUserIdFromAccessToken(session?.accessToken) ??
		session?.user?.id;

	// The query is idle until a workspace is active, so the workspace list
	// itself must count as loading or this would read as "unresolved".
	const isLoading =
		status === "loading" ||
		isWorkspacesLoading ||
		(!!activeWorkspaceId && isMeLoading);
	const isUnresolved = !isLoading && !me;

	useEffect(() => {
		if (!isUnresolved || process.env.NODE_ENV === "production") return;
		console.warn(
			"[permissions] Couldn't read your role in this workspace (GET /memberships/me), so every control is shown and the backend will enforce.",
			{ workspaceId: activeWorkspaceId, userId, requestFailed: isMeError },
		);
	}, [isUnresolved, activeWorkspaceId, userId, isMeError]);

	return useMemo(() => {
		const base = me
			? permissionsFrom(me.permissions, {
					isOwner: (me.assignedRole?.systemKey ?? me.role) === "OWNER",
					userId,
				})
			: isUnresolved
				? UNRESTRICTED_PERMISSIONS
				: NO_PERMISSIONS;
		return { ...base, userId, isLoading, isRoleKnown: !!me };
	}, [me, isUnresolved, isLoading, userId]);
}
