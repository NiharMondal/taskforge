"use client";

import { Button } from "@heroui/react";
import { PASSWORD_RESET_TTL_MINUTES } from "@taskforge/shared";
import { MailCheck } from "lucide-react";

const address = (email: string) => (
	<span className="font-medium text-foreground">{email}</span>
);

/** What the email is for, and what to say about it. */
const COPY = {
	"sign-up": {
		sent: (email: string) => (
			<>
				We sent a link to {address(email)}. Open it within 24 hours to
				finish creating your account.
			</>
		),
		hint: "Nothing arrived? Check your spam folder. If this address already has an account, we emailed it a sign-in link instead.",
	},
	// The backend doesn't say whether the address has an account, so neither
	// do we.
	"password-reset": {
		sent: (email: string) => (
			<>
				If {address(email)} has an account, we sent it a link. Open it
				within {PASSWORD_RESET_TTL_MINUTES} minutes to choose a new password.
			</>
		),
		hint: "Nothing arrived? Check your spam folder, and that this is the address you sign in with.",
	},
} as const;

/**
 * Shown once an emailed link is on its way: after registering (the account
 * only exists once the link is followed) or after "forgot password". "Send
 * again" re-submits the same request (the backend limits how many links one
 * address gets, quietly).
 */
export function CheckEmailNotice({
	email,
	onResend,
	isResending,
	onChangeEmail,
	variant = "sign-up",
}: {
	email: string;
	onResend: () => void;
	isResending: boolean;
	onChangeEmail: () => void;
	variant?: keyof typeof COPY;
}) {
	const copy = COPY[variant];

	return (
		<div className="flex flex-col items-center gap-4 text-center">
			<MailCheck className="size-10 text-accent" aria-hidden />
			<div className="flex flex-col gap-1">
				<p className="font-medium">Check your email</p>
				<p className="text-sm text-muted">{copy.sent(email)}</p>
			</div>
			<div className="flex flex-wrap justify-center gap-2">
				<Button
					variant="outline"
					onPress={onResend}
					isDisabled={isResending}
				>
					{isResending ? "Sending…" : "Send again"}
				</Button>
				<Button variant="ghost" onPress={onChangeEmail}>
					Use a different email
				</Button>
			</div>
			<p className="text-xs text-muted">{copy.hint}</p>
		</div>
	);
}
