"use client";

import { Button } from "@heroui/react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";

import GoogleIcon from "@/shared/icons/google-icon";

import { resolvePostLoginTarget } from "../lib/callback-url";

/**
 * "Continue with Google", on both sign-in and sign-up: a first Google sign-in
 * creates the account (and its workspace) on the backend, so there is no
 * separate Google sign-up. Keeps `callbackUrl`.
 */
export default function GoogleSignInButton() {
	const searchParams = useSearchParams();

	return (
		<Button
			type="button"
			variant="outline"
			fullWidth
			onPress={() =>
				signIn("google", {
					redirectTo: resolvePostLoginTarget(searchParams.get("callbackUrl")),
				})
			}
		>
			<GoogleIcon />
			Continue with Google
		</Button>
	);
}

/** The line between "Continue with Google" and the email form. */
export function AuthDivider() {
	return (
		<div className="my-5 flex items-center gap-3">
			<div className="h-px flex-1 bg-border" />
			<span className="text-xs text-muted">or continue with email</span>
			<div className="h-px flex-1 bg-border" />
		</div>
	);
}
