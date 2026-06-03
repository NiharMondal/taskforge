import LoginForm from "@/features/auth/components/login-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@heroui/react";
import type { Metadata } from "next";
import Link from "next/link";
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

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
