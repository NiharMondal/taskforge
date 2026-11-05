"use client";

import { useState } from "react";

import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Spinner,
	toast,
} from "@heroui/react";
import { MailCheck } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { getApiErrorMessage } from "@/lib/api-error";

import {
	useAcceptInvitation,
	useInvitationPreview,
} from "../hooks/use-invitations";

/**
 * Landing card for `/invitations/accept?token=…`. The token is looked up first
 * (public `GET /invitations/validate`) to show the workspace, role and invited
 * email; an unknown, used, revoked or expired token shows the backend's reason
 * instead of an Accept button.
 *
 * Accepting creates the membership, switches the active workspace to the new
 * tenant, and lands on the dashboard. The backend only accepts it for the
 * invited email, so a mismatch with the signed-in account is flagged up front.
 */
export default function AcceptInviteView({ token }: { token: string }) {
	const router = useRouter();
	const { setActiveWorkspaceId } = useWorkspace();
	const { mutateAsync: acceptInvitation, isPending } = useAcceptInvitation();
	const [error, setError] = useState<string | null>(null);
	const { data: session } = useSession();
	const {
		data: preview,
		isLoading,
		error: previewError,
	} = useInvitationPreview(token);

	const invalidReason = !token
		? "This invitation link is missing its token."
		: previewError
			? getApiErrorMessage(previewError, "This invitation isn’t valid.")
			: null;
	const signedInEmail = session?.user?.email;
	const isOtherAccount =
		!!preview &&
		!!signedInEmail &&
		signedInEmail.toLowerCase() !== preview.email.toLowerCase();

	const handleAccept = async () => {
		setError(null);
		try {
			const res = await acceptInvitation({ token });
			toast.success(res.message || "Invitation accepted");
			// Drop the user straight into their new workspace; if the response
			// doesn't carry the id, the dashboard falls back to a valid one.
			if (res.data?.workspaceId) {
				setActiveWorkspaceId(res.data.workspaceId);
			}
			router.push("/dashboard");
		} catch (err) {
			setError(getApiErrorMessage(err, "Failed to accept invitation"));
		}
	};

	return (
		<Card className="w-full max-w-md">
			<CardHeader className="text-center">
				<MailCheck className="mx-auto h-10 w-10 text-accent" />
				<CardTitle className="text-2xl font-semibold">
					You’ve been invited
				</CardTitle>
				<CardDescription>
					{preview ? (
						<>
							Join{" "}
							<span className="font-medium text-foreground">
								{preview.workspaceName}
							</span>{" "}
							on TaskForge as {preview.roleName}.
						</>
					) : (
						"Accept the invitation to join the workspace on TaskForge."
					)}
				</CardDescription>
			</CardHeader>

			<CardContent className="flex flex-col gap-4">
				{isLoading && (
					<div className="flex justify-center">
						<Spinner size="sm" />
					</div>
				)}
				{invalidReason && (
					<p className="rounded-lg border border-border bg-surface p-3 text-sm text-danger">
						{invalidReason}
					</p>
				)}
				{isOtherAccount && (
					<p className="rounded-lg border border-border bg-surface p-3 text-sm text-warning">
						This invitation is for {preview.email}, but you’re signed
						in as {signedInEmail}. Sign in with the invited email to
						accept it.
					</p>
				)}
				{error && (
					<p className="rounded-lg border border-border bg-surface p-3 text-sm text-danger">
						{error}
					</p>
				)}

				<div className="flex justify-center gap-2">
					<Button
						variant="outline"
						type="button"
						onClick={() => router.push("/dashboard")}
					>
						Go to Dashboard
					</Button>
					<Button
						type="button"
						onClick={handleAccept}
						isDisabled={isPending || !preview || isOtherAccount}
					>
						{isPending ? "Accepting…" : "Accept Invitation"}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
