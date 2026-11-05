import { PLAN_LIMITS, PRO_TRIAL_DAYS } from "@taskforge/shared";

/**
 * The facts the Terms and Privacy pages need about who runs TaskForge. Fill in
 * the bracketed values before launch; both pages read them from here.
 */
export const LEGAL = {
	/** The person or company that operates TaskForge and is party to the terms. */
	operator: "Nihar Mondal",
	/** Where users send privacy requests, legal notices and questions. */
	contactEmail: "developernihar@gmail.com",
	/** The law that governs the terms, and whose courts hear disputes. */
	governingLaw: "Dhaka, Bangladesh",
	/** Change on both pages' `lastUpdated` whenever either text changes. */
	lastUpdated: "November 5, 2026",
	/** Users must be at least this old. */
	minimumAge: 16,
} as const;

export const FREE_MEMBER_LIMIT = PLAN_LIMITS.FREE.members;
export { PRO_TRIAL_DAYS };
