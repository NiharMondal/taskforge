import type { Metadata } from "next";
import { Suspense } from "react";

import AuthPageHeader from "@/features/auth/components/auth-page-header";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export const metadata: Metadata = {
	title: "Choose a new password · TaskForge",
};

/** Where the link in a reset email lands (`?token=…`). Public. */
export default function ResetPasswordPage() {
	return (
		<>
			<AuthPageHeader
				title="Choose a new password"
				description="This signs you out on every device."
			/>

			{/* useSearchParams() in ResetPasswordForm requires a Suspense boundary. */}
			<Suspense fallback={null}>
				<ResetPasswordForm />
			</Suspense>
		</>
	);
}
