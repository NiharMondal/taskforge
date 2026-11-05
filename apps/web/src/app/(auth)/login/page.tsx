import type { Metadata } from "next";
import { Suspense } from "react";

import AuthPageHeader from "@/features/auth/components/auth-page-header";
import AuthSwitchLink from "@/features/auth/components/auth-switch-link";
import LoginForm from "@/features/auth/components/login-form";

export const metadata: Metadata = {
	title: "Sign in · TaskForge",
};

export default function LoginPage() {
	return (
		<>
			<AuthPageHeader
				title="Welcome back"
				description="Sign in to pick up where your team left off."
			/>

			{/* useSearchParams() in LoginForm requires a Suspense boundary. */}
			<Suspense fallback={null}>
				<LoginForm />
			</Suspense>

			<p className="mt-8 text-center text-sm text-muted">
				New to TaskForge?{" "}
				{/* useSearchParams() in AuthSwitchLink requires a Suspense boundary. */}
				<Suspense fallback={null}>
					<AuthSwitchLink href="/register">Create an account</AuthSwitchLink>
				</Suspense>
			</p>
		</>
	);
}
