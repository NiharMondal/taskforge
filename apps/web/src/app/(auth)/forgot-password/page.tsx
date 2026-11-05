import type { Metadata } from "next";
import { Suspense } from "react";

import AuthPageHeader from "@/features/auth/components/auth-page-header";
import AuthSwitchLink from "@/features/auth/components/auth-switch-link";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export const metadata: Metadata = {
	title: "Forgot password · TaskForge",
};

/**
 * "Forgot password?": emails a reset link. Public, and open to signed-in users
 * too (a Google-only account sets its first password this way).
 */
export default function ForgotPasswordPage() {
	return (
		<>
			<AuthPageHeader
				title="Forgot your password?"
				description="Enter the email you sign in with and we'll send you a link to choose a new one."
			/>

			{/* useSearchParams() in ForgotPasswordForm requires a Suspense boundary. */}
			<Suspense fallback={null}>
				<ForgotPasswordForm />
			</Suspense>

			<p className="mt-8 text-center text-sm text-muted">
				Remembered it?{" "}
				{/* useSearchParams() in AuthSwitchLink requires a Suspense boundary. */}
				<Suspense fallback={null}>
					<AuthSwitchLink href="/login">Sign in</AuthSwitchLink>
				</Suspense>
			</p>
		</>
	);
}
