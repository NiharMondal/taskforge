import type { Metadata } from "next";
import { Suspense } from "react";

import AuthPageHeader from "@/features/auth/components/auth-page-header";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

// Not indexed (the root layout's default): a utility page, reached from a link.
export const metadata: Metadata = {
	title: "Choose a new password",
	description: "Choose a new password for your TaskForge account.",
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
