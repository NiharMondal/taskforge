/**
 * Where to land after signing in or registering. The proxy puts the originally
 * requested URL (absolute, e.g. an `/invitations/accept?token=…` link) in
 * `callbackUrl`; honoring it only when same-origin prevents open redirects.
 */
export function resolvePostLoginTarget(callbackUrl: string | null): string {
	if (!callbackUrl) return "/dashboard";
	try {
		const url = new URL(callbackUrl, window.location.origin);
		if (url.origin === window.location.origin) {
			return url.pathname + url.search;
		}
	} catch {
		// Malformed callbackUrl — fall through to the dashboard.
	}
	return "/dashboard";
}

/**
 * `path` with `callbackUrl` carried over, so moving between /login and
 * /register doesn't drop where the user was going (e.g. an invite link).
 */
export function withCallbackUrl(path: string, callbackUrl: string | null) {
	return callbackUrl
		? `${path}?callbackUrl=${encodeURIComponent(callbackUrl)}`
		: path;
}

const AFTER_VERIFICATION_KEY = "taskforge.afterEmailVerification";

/**
 * Remember where a new user was going (e.g. an invite link) while they leave
 * to open the verification email. Kept in this browser only: opening the link
 * elsewhere lands on the dashboard.
 */
export function rememberPostVerificationTarget(callbackUrl: string | null) {
	try {
		localStorage.setItem(
			AFTER_VERIFICATION_KEY,
			resolvePostLoginTarget(callbackUrl),
		);
	} catch {
		// Storage unavailable: they land on the dashboard.
	}
}

/** Where to go after confirming the email; forgets it once read. */
export function takePostVerificationTarget(): string {
	try {
		const target = localStorage.getItem(AFTER_VERIFICATION_KEY);
		localStorage.removeItem(AFTER_VERIFICATION_KEY);
		// Re-checked: storage is just another input.
		return resolvePostLoginTarget(target);
	} catch {
		return "/dashboard";
	}
}
