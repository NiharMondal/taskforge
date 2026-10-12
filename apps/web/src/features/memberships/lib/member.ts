import type { Member } from "../types/membership-types";

/** A member's email (`user.email` on the roster row). */
export const getMemberEmail = (member: Member): string | undefined =>
	member.user?.email ?? undefined;

/** Best human label for a member: name, else email, else a placeholder. */
export const getMemberName = (member: Member): string =>
	member.user?.name || getMemberEmail(member) || "Unknown user";
