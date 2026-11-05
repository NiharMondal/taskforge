"use client";

import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	toast,
} from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { MIN_PASSWORD_LENGTH } from "@taskforge/shared";
import { signOut } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { FormTextField, FormWrapper } from "@/components/form-element";
import { forgotPassword } from "@/features/auth/api/auth-api";
import PasswordVisibilityToggle from "@/features/auth/components/password-visibility-toggle";
import { useChangePassword } from "@/features/auth/hooks/use-change-password";
import {
	changePasswordSchema,
	type ChangePasswordInput,
} from "@/features/auth/schemas/auth-schema";
import { getApiErrorMessage } from "@/lib/api-error";

/**
 * Settings → Profile: change the signed-in user's password
 * (`PATCH /auth/password`). The backend ends every session on success, this
 * one included, so we sign out and send the user to `/login`, which says why.
 * A Google-only account (`hasPassword: false`) has no password to change; it
 * can ask for a reset link (`POST /auth/forgot-password`) to set one.
 */
export default function ChangePasswordCard({
	hasPassword,
	email,
}: {
	hasPassword: boolean;
	email: string;
}) {
	const [showPassword, setShowPassword] = useState(false);
	const [isSendingLink, setIsSendingLink] = useState(false);
	const { mutateAsync: changePassword } = useChangePassword();

	const sendSetPasswordLink = async () => {
		setIsSendingLink(true);
		try {
			await forgotPassword({ email });
			toast.success(`We emailed ${email} a link to set a password`);
		} catch (error) {
			toast.danger(getApiErrorMessage(error, "Couldn't send the link"));
		} finally {
			setIsSendingLink(false);
		}
	};

	const methods = useForm<ChangePasswordInput>({
		resolver: zodResolver(changePasswordSchema),
		defaultValues: { currentPassword: "", password: "", confirmPassword: "" },
	});

	const onSubmit = async (values: ChangePasswordInput) => {
		try {
			// Only what the backend reads: `confirmPassword` is form-only.
			await changePassword({
				currentPassword: values.currentPassword,
				newPassword: values.password,
			});
			await signOut({ redirectTo: "/login?passwordChanged=1" });
		} catch (error) {
			toast.danger(getApiErrorMessage(error, "Couldn't change your password"));
		}
	};

	const toggle = (
		<PasswordVisibilityToggle
			isVisible={showPassword}
			onToggle={() => setShowPassword((prev) => !prev)}
		/>
	);
	const type = showPassword ? "text" : "password";

	return (
		<Card>
			<CardHeader>
				<CardTitle>Password</CardTitle>
				<CardDescription>
					{hasPassword
						? "Changing your password signs you out everywhere, including here."
						: "You sign in with Google. To also sign in with a password, we'll email you a link to set one."}
				</CardDescription>
			</CardHeader>
			{!hasPassword && (
				<CardContent>
					<Button
						variant="outline"
						onPress={sendSetPasswordLink}
						isDisabled={isSendingLink}
					>
						{isSendingLink ? "Sending…" : "Email me a link"}
					</Button>
				</CardContent>
			)}
			{hasPassword && (
				<CardContent>
					<FormWrapper methods={methods} onSubmit={onSubmit}>
						<FormTextField
							isRequired
							name="currentPassword"
							label="Current password"
							type={type}
							ornament={toggle}
						/>
						<FormTextField
							isRequired
							name="password"
							label="New password"
							type={type}
							placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
							ornament={toggle}
						/>
						<FormTextField
							isRequired
							name="confirmPassword"
							label="Confirm new password"
							type={type}
							ornament={toggle}
						/>
						<Button
							type="submit"
							variant="primary"
							className="mt-2"
							isDisabled={methods.formState.isSubmitting}
						>
							{methods.formState.isSubmitting
								? "Changing…"
								: "Change password"}
						</Button>
					</FormWrapper>
				</CardContent>
			)}
		</Card>
	);
}
