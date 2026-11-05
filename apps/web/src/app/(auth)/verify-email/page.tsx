import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@heroui/react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { VerifyEmailView } from "@/features/auth/components/verify-email-view";

export const metadata: Metadata = {
  title: "Confirm your email · TaskForge",
};

/** Where the link in a verification email lands (`?token=…`). Public. */
export default function VerifyEmailPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-semibold">
          Confirm your email
        </CardTitle>
        <CardDescription>One step left to create your account</CardDescription>
      </CardHeader>

      <CardContent>
        {/* useSearchParams() in VerifyEmailView requires a Suspense boundary. */}
        <Suspense fallback={null}>
          <VerifyEmailView />
        </Suspense>
      </CardContent>
    </Card>
  );
}
