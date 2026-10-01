"use client";

import { Button, toast } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { FormTextField, FormWrapper } from "@/components/form-element";
import { Eye, EyeOff } from "lucide-react";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { register } from "../api/auth-api";
import { registerSchema, type RegisterInput } from "../schemas/auth-schema";

export function RegisterForm() {
	const [showPassword, setShowPassword] = useState(false);

	const methods = useForm<RegisterInput>({
		resolver: zodResolver(registerSchema),
		defaultValues: {
			name: "",
			email: "",
			password: "",
			confirmPassword: "",
		},
	});

	const onSubmit = async (values: RegisterInput) => {
		try {
			const res = await register(values);
			if (res.success) {
				await signIn("credentials", {
					email: values.email,
					password: values.password,
					redirect: true,
					redirectTo: "/dashboard",
				});
			}
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
		} catch (error: any) {
			toast.danger(error?.message);
		}
	};

	return (
		<FormWrapper onSubmit={onSubmit} methods={methods}>
			<FormTextField
				name="name"
				label="Full name"
				placeholder="Ada Lovelace"
			/>

			<FormTextField
				name="email"
				label="Email"
				type="email"
				placeholder="you@company.com"
			/>

			<FormTextField
				name="password"
				label="Password"
				type={showPassword ? "text" : "password"}
				placeholder="At least 8 characters"
				ornament={
					<div onClick={() => setShowPassword((prev) => !prev)}>
						{showPassword ? (
							<Eye size={20} />
						) : (
							<EyeOff size={20} />
						)}
					</div>
				}
			/>

			<FormTextField
				name="confirmPassword"
				label="Confirm password"
				type={showPassword ? "text" : "password"}
				placeholder="Re-enter your password"
				ornament={
					<div onClick={() => setShowPassword((prev) => !prev)}>
						{showPassword ? (
							<Eye size={20} />
						) : (
							<EyeOff size={20} />
						)}
					</div>
				}
			/>

			<Button type="submit" variant="primary" fullWidth className="mt-2">
				Create Account
			</Button>
		</FormWrapper>
	);
}
