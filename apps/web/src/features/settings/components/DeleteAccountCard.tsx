"use client";

import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Input,
	Label,
	TextField,
	toast,
} from "@heroui/react";
import { useBoolean } from "ahooks";
import { Trash2 } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";

import ConfirmModal from "@/components/ui/confirm-modal";
import { useDeleteAccount } from "@/features/profile/hooks/use-profile";
import { getApiErrorMessage } from "@/lib/api-error";

/**
 * Settings → Profile "Danger zone": deletes the signed-in user's account
 * (`DELETE /users/me`, `apps/web/spec/account.md`). Typing the email confirms
 * it; an account with a password also re-enters it (a Google-only one sends
 * the typed email instead). The backend refuses (409, its message names them)
 * while the user owns a workspace other people use. On success the session is
 * signed out to `/login`, which says what happened.
 */
export default function DeleteAccountCard({
	hasPassword,
	email,
}: {
	hasPassword: boolean;
	email: string;
}) {
	const [isOpen, { setTrue: open, setFalse: closeModal }] = useBoolean();
	const [password, setPassword] = useState("");
	const { mutateAsync: deleteAccount, isPending } = useDeleteAccount();

	const close = () => {
		setPassword("");
		closeModal();
	};

	const handleDelete = async () => {
		try {
			await deleteAccount(
				hasPassword ? { password } : { confirmEmail: email },
			);
			await signOut({ redirectTo: "/login?accountDeleted=1" });
		} catch (error) {
			toast.danger(getApiErrorMessage(error, "Couldn't delete your account"));
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-danger">Danger zone</CardTitle>
				<CardDescription>
					Deleting your account removes you from every workspace and deletes
					the ones only you belong to. Issues and comments you wrote in shared
					workspaces stay, shown as by “Deleted user”. If you own a workspace
					other people use, transfer it (Settings → General) or delete it
					first.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Button variant="danger" className="self-start" onClick={open}>
					<Trash2 className="size-4" />
					Delete account
				</Button>

				<ConfirmModal
					isOpen={isOpen}
					onClose={close}
					title="Delete account"
					description={
						<>
							Delete{" "}
							<span className="font-medium text-foreground">{email}</span>{" "}
							and every workspace only you belong to? This can’t be undone.
							Download your data first if you want a copy.
						</>
					}
					confirmLabel="Delete account"
					pendingLabel="Deleting…"
					isPending={isPending}
					onConfirm={handleDelete}
					typeToConfirm={email}
					canConfirm={!hasPassword || password.length > 0}
				>
					{hasPassword && (
						<TextField
							type="password"
							value={password}
							onChange={setPassword}
							autoComplete="current-password"
						>
							<Label className="font-normal">Your password</Label>
							<Input className="w-full shadow-none" />
						</TextField>
					)}
				</ConfirmModal>
			</CardContent>
		</Card>
	);
}
