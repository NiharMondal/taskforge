"use client";

import AcceptInviteView from "@/features/invitations/components/AcceptInviteView";
import { useSearchParams } from "next/navigation";

export default function AcceptPage() {
	const searchParams = useSearchParams();
	const token = searchParams.get("token") ?? "";

	return <AcceptInviteView token={token} />;
}
