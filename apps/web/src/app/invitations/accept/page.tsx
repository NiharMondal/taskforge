"use client";

import { Suspense } from "react";

import { Spinner } from "@heroui/react";
import { useSearchParams } from "next/navigation";

import AcceptInviteView from "@/features/invitations/components/AcceptInviteView";

function AcceptInviteFromQuery() {
	const searchParams = useSearchParams();
	const token = searchParams.get("token") ?? "";

	return <AcceptInviteView token={token} />;
}

export default function AcceptPage() {
	// useSearchParams() requires a Suspense boundary above it.
	return (
		<Suspense fallback={<Spinner />}>
			<AcceptInviteFromQuery />
		</Suspense>
	);
}
