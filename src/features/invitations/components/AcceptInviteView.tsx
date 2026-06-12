"use client";

import { useState } from "react";

import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	toast,
} from "@heroui/react";
import { MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";

import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { getApiErrorMessage } from "@/lib/api-error";

import { useAcceptInvitation } from "../hooks/use-invitations";

/**
 * Landing card for `/invite/[token]`. The copy stays generic: there is no
 * token-lookup endpoint, and `GET /invitations` is scoped to a workspace the
 * invitee doesn't belong to yet — so the workspace name can't be shown.
 *
 * Accepting creates the membership, switches the active workspace to the new
 * tenant, and lands on the dashboard. Expired/revoked/already-accepted tokens
 * surface the backend's error message inline (not just a toast).
 */
export default function AcceptInviteView({ token }: { token: string }) {
	const router = useRouter();
	const { setActiveWorkspaceId } = useWorkspace();
	const { mutateAsync: acceptInvitation, isPending } = useAcceptInvitation();
	const [error, setError] = useState<string | null>(null);

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
			setError(getApiErrorMessage(err || "Failed to accept invitation"));
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
					Accept the invitation to join the workspace on TaskForge.
				</CardDescription>
			</CardHeader>

			<CardContent className="flex flex-col gap-4">
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
						isDisabled={isPending}
					>
						{isPending ? "Accepting…" : "Accept Invitation"}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
