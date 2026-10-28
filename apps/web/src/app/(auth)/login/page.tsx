import AuthSwitchLink from "@/features/auth/components/auth-switch-link";
import LoginForm from "@/features/auth/components/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@heroui/react";
import type { Metadata } from "next";
import { Suspense } from "react";


export const metadata: Metadata = {
  title: "Sign in · TaskForge",
};

export default function LoginPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-semibold">Welcome back</CardTitle>
        <CardDescription>Sign in to your TaskForge workspace</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {/* useSearchParams() in LoginForm requires a Suspense boundary. */}
        <Suspense fallback={null}>
            <LoginForm/>
        </Suspense>

        <p className="text-center text-sm text-muted">
          Don&apos;t have an account?{" "}
          {/* useSearchParams() in AuthSwitchLink requires a Suspense boundary. */}
          <Suspense fallback={null}>
            <AuthSwitchLink href="/register">Create one</AuthSwitchLink>
          </Suspense>
        </p>
      </CardContent>
    </Card>
  );
}
