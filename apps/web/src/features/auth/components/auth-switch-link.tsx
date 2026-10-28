"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { withCallbackUrl } from "../lib/callback-url";

/** The "Sign in" / "Create one" link between the auth pages, keeping `callbackUrl`. */
export default function AuthSwitchLink({
	href,
	children,
}: {
	href: "/login" | "/register";
	children: React.ReactNode;
}) {
	const searchParams = useSearchParams();

	return (
		<Link
			href={withCallbackUrl(href, searchParams.get("callbackUrl"))}
			className="font-medium text-accent hover:underline"
		>
			{children}
		</Link>
	);
}
