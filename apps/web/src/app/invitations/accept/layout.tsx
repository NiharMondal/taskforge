import { redirect } from "next/navigation";

import { WorkspaceProvider } from "@/features/workspace/context/workspace-context";
import { auth } from "@/lib/auth";

/**
 * Server layout for the invitation-accept page. Lives outside the
 * `(dashboard)` group so the invitee sees a focused card instead of the
 * sidebar shell, but still needs:
 *  - the session gate (defense in depth alongside `proxy.ts`, which already
 *    bounces anonymous visitors to `/login?callbackUrl=<invite url>`), and
 *  - `WorkspaceProvider`, so accepting can switch the active workspace.
 * Query/Auth providers come from the root layout.
 */
export default async function InvitationLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await auth();
	if (!session) redirect("/login");

	return (
		<WorkspaceProvider>
			<main className="flex min-h-dvh items-center justify-center p-6">
				{children}
			</main>
		</WorkspaceProvider>
	);
}
