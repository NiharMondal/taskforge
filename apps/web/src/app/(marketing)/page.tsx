import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@heroui/react";
import {
	Building2,
	History,
	KanbanSquare,
	ShieldCheck,
	Users,
	Workflow,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PRIMARY_LINK, SECONDARY_LINK } from "@/features/marketing/constants";
import { auth } from "@/lib/auth";

export const metadata: Metadata = {
	title: "TaskForge · Plan, track and ship work as a team",
};

const FEATURES = [
	{
		icon: KanbanSquare,
		title: "Sprints and boards",
		description:
			"Plan sprints from the backlog, then move work across the active sprint's board.",
	},
	{
		icon: Workflow,
		title: "Your own workflow",
		description:
			"Each project gets its own statuses and the moves allowed between them.",
	},
	{
		icon: ShieldCheck,
		title: "Roles and permissions",
		description:
			"Built-in roles for everyone, and custom roles for exactly the access each person needs.",
	},
	{
		icon: Users,
		title: "Invite your team",
		description:
			"Bring people in by email. Comments, labels and assignees keep everyone on the same page.",
	},
	{
		icon: History,
		title: "Full history",
		description:
			"Every change to an issue is recorded, so you can see who changed what and when.",
	},
	{
		icon: Building2,
		title: "Separate workspaces",
		description:
			"Keep each team or client in its own workspace, with its own members and billing.",
	},
];

/**
 * The landing page. A signed-in visitor goes straight to the app; the
 * session is read here because `/` is public, so `proxy.ts` lets everyone in.
 */
export default async function LandingPage() {
	const session = await auth();
	if (session?.user && !session.error) redirect("/dashboard");

	return (
		<>
			<section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-20 text-center">
				<h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
					Plan, track and ship work as a team
				</h1>
				<p className="max-w-xl text-lg text-muted">
					TaskForge is an issue tracker for teams that run in sprints: a
					backlog, a board, and a workflow that fits each project.
				</p>
				<div className="flex flex-wrap justify-center gap-3">
					<Link href="/register" className={PRIMARY_LINK}>
						Get started free
					</Link>
					<Link href="/pricing" className={SECONDARY_LINK}>
						See pricing
					</Link>
				</div>
			</section>

			<section className="mx-auto grid max-w-6xl gap-4 px-4 pb-20 sm:grid-cols-2 lg:grid-cols-3">
				{FEATURES.map(({ icon: Icon, title, description }) => (
					<Card key={title}>
						<CardHeader>
							<span className="mb-2 flex size-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
								<Icon className="size-5" aria-hidden />
							</span>
							<CardTitle>{title}</CardTitle>
							<CardDescription>{description}</CardDescription>
						</CardHeader>
						<CardContent />
					</Card>
				))}
			</section>
		</>
	);
}
