"use client";

import { Button, toast } from "@heroui/react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { takePostVerificationTarget } from "../lib/callback-url";

const ERRORS: Record<string, string> = {
	invalid_link:
		"This link is invalid, has expired or was already used. Sign up again to get a new one.",
	email_taken: "This email already has an account. Sign in instead.",
};

/**
 * Confirms the sign-up behind the emailed link and signs in, through the
 * Auth.js `email-verification` provider. It waits for a click rather than
 * confirming on load, so a mail scanner that opens links can't use it up.
 */
export function VerifyEmailView() {
	const token = useSearchParams().get("token");
	const router = useRouter();
	const [isPending, setIsPending] = useState(false);
	const [error, setError] = useState<string | null>(
		token ? null : ERRORS.invalid_link,
	);

	const confirm = async () => {
		if (!token) return;
		setIsPending(true);
		try {
			const res = await signIn("email-verification", {
				token,
				redirect: false,
			});
			// As on the login form, `error` is the signal; `code` is set for the
			// rejections the provider raises itself.
			if (res.error) {
				setError(
					(res.code && ERRORS[res.code]) ??
						"Something went wrong. Please try again.",
				);
				return;
			}
			toast.success("Email confirmed. Welcome to TaskForge!");
			router.push(takePostVerificationTarget());
		} catch {
			setError("Something went wrong. Please try again.");
		} finally {
			setIsPending(false);
		}
	};

	if (error) {
		return (
			<div className="flex flex-col items-center gap-4 text-center">
				<p className="text-sm text-danger" role="alert">
					{error}
				</p>
				<div className="flex gap-4 text-sm">
					<Link
						href="/register"
						className="font-medium text-accent hover:underline"
					>
						Sign up
					</Link>
					<Link
						href="/login"
						className="font-medium text-accent hover:underline"
					>
						Sign in
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4 text-center">
			<p className="text-sm text-muted">
				Confirm this address to create your account and sign in.
			</p>
			<Button
				variant="primary"
				fullWidth
				onPress={confirm}
				isDisabled={isPending}
			>
				{isPending ? "Confirming…" : "Confirm email and sign in"}
			</Button>
		</div>
	);
}
