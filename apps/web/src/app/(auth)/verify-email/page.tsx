import type { Metadata } from "next";
import { Suspense } from "react";

import AuthPageHeader from "@/features/auth/components/auth-page-header";
import { VerifyEmailView } from "@/features/auth/components/verify-email-view";

// Not indexed (the root layout's default): a utility page, reached from a link.
export const metadata: Metadata = {
	title: "Confirm your email",
	description: "Confirm your email address to finish creating your TaskForge account.",
};

/** Where the link in a verification email lands (`?token=…`). Public. */
export default function VerifyEmailPage() {
	return (
		<>
			<AuthPageHeader
				title="Confirm your email"
				description="One step left to create your account."
			/>

			{/* useSearchParams() in VerifyEmailView requires a Suspense boundary. */}
			<Suspense fallback={null}>
				<VerifyEmailView />
			</Suspense>
		</>
	);
}
