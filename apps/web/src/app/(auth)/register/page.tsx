import { PLAN_LIMITS } from "@taskforge/shared";
import type { Metadata } from "next";
import { Suspense } from "react";

import AuthPageHeader from "@/features/auth/components/auth-page-header";
import AuthSwitchLink from "@/features/auth/components/auth-switch-link";
import { RegisterForm } from "@/features/auth/components/register-form";

export const metadata: Metadata = {
	title: "Create account · TaskForge",
};

export default function RegisterPage() {
	return (
		<>
			<AuthPageHeader
				title="Create your account"
				description={`Free for teams of up to ${PLAN_LIMITS.FREE.members}. No credit card needed.`}
			/>

			{/* useSearchParams() in RegisterForm and AuthSwitchLink requires a Suspense boundary. */}
			<Suspense fallback={null}>
				<RegisterForm />
			</Suspense>

			<p className="mt-8 text-center text-sm text-muted">
				Already have an account?{" "}
				<Suspense fallback={null}>
					<AuthSwitchLink href="/login">Sign in</AuthSwitchLink>
				</Suspense>
			</p>
		</>
	);
}
