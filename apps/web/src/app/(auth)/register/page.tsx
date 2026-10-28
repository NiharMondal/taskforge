import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@heroui/react";
import type { Metadata } from "next";
import { Suspense } from "react";

import AuthSwitchLink from "@/features/auth/components/auth-switch-link";
import { RegisterForm } from "@/features/auth/components/register-form";

export const metadata: Metadata = {
  title: "Create account · TaskForge",
};

export default function RegisterPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-semibold">
          Create your account
        </CardTitle>
        <CardDescription>Start managing work in TaskForge</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {/* useSearchParams() in RegisterForm and AuthSwitchLink requires a Suspense boundary. */}
        <Suspense fallback={null}>
          <RegisterForm />
        </Suspense>

        <p className="text-center text-sm text-muted">
          Already have an account?{" "}
          <Suspense fallback={null}>
            <AuthSwitchLink href="/login">Sign in</AuthSwitchLink>
          </Suspense>
        </p>
      </CardContent>
    </Card>
  );
}
