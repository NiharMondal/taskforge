import type { Member } from "../types/membership-types";

/** A member's email, which the API nests under `user.auth.email`. */
export const getMemberEmail = (member: Member): string | undefined =>
	member.user?.auth?.email ?? undefined;

/** Best human label for a member: name, else email, else a placeholder. */
export const getMemberName = (member: Member): string =>
	member.user?.name || getMemberEmail(member) || "Unknown user";
