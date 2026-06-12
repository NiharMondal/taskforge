"use client";

import { use } from "react";

import AcceptInviteView from "@/features/invitations/components/AcceptInviteView";

/**
 * Invitation landing: `/invite/[token]` (linked from the invite email).
 *
 * Client component (the accept mutation + workspace switch live in the view),
 * so the Next 16 `params` Promise is unwrapped with React's `use()`.
 */
export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  return <AcceptInviteView token={token} />;
}
