"use client";

import { Button } from "@heroui/react";
import { MailCheck } from "lucide-react";

/**
 * Shown after registering: the account only exists once the emailed link is
 * followed. "Send again" re-submits the same sign-up (the backend limits how
 * many links one address gets, quietly).
 */
export function CheckEmailNotice({
	email,
	onResend,
	isResending,
	onChangeEmail,
}: {
	email: string;
	onResend: () => void;
	isResending: boolean;
	onChangeEmail: () => void;
}) {
	return (
		<div className="flex flex-col items-center gap-4 text-center">
			<MailCheck className="size-10 text-accent" aria-hidden />
			<div className="flex flex-col gap-1">
				<p className="font-medium">Check your email</p>
				<p className="text-sm text-muted">
					We sent a link to{" "}
					<span className="font-medium text-foreground">{email}</span>.
					Open it within 24 hours to finish creating your account.
				</p>
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
			<p className="text-xs text-muted">
				Nothing arrived? Check your spam folder. If this address already
				has an account, we emailed it a sign-in link instead.
			</p>
		</div>
	);
}
