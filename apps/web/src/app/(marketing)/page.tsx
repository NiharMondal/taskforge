import { PLAN_LIMITS } from "@taskforge/shared";
import {
	ArrowRight,
	Building2,
	History,
	KanbanSquare,
	ShieldCheck,
	Sparkles,
	Users,
	Workflow,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import BoardPreview from "@/features/marketing/components/BoardPreview";
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
			"Plan sprints from the backlog, then drag work across the active sprint's board.",
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
		title: "Built for teams",
		description:
			"Invite people by email. Comments, labels and assignees keep everyone on the same page.",
	},
	{
		icon: History,
		title: "Full history",
		description:
			"Every change to an issue is recorded, so you always know who changed what, and when.",
	},
	{
		icon: Building2,
		title: "Separate workspaces",
		description:
			"Keep each team or client in its own workspace, with its own members and billing.",
	},
];

const STEPS = [
	{
		title: "Create a workspace",
		description: "Sign up and your first workspace is ready, no setup call.",
	},
	{
		title: "Invite your team",
		description: "Send invitations by email and pick each person's role.",
	},
	{
		title: "Plan and ship",
		description: "Fill the backlog, start a sprint and move work to done.",
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
			<section className="relative overflow-hidden">
				<div className="hero-glow pointer-events-none absolute inset-0" />
				<div className="grid-pattern pointer-events-none absolute inset-0" />

				<div className="relative mx-auto flex max-w-6xl flex-col items-center gap-8 px-4 pt-20 pb-16 text-center sm:pt-28">
					<span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 px-3 py-1 text-xs font-medium text-muted backdrop-blur">
						<Sparkles className="size-3.5 text-accent" aria-hidden />
						Sprints, boards and custom workflows
					</span>

					<h1 className="max-w-4xl text-4xl font-semibold tracking-tight sm:text-6xl">
						Where teams forge plans into{" "}
						<span className="bg-linear-to-r from-accent to-[oklch(66%_0.2_320)] bg-clip-text text-transparent">
							shipped work
						</span>
					</h1>

					<p className="max-w-2xl text-lg text-muted">
						TaskForge is the issue tracker for teams that run in sprints: one
						backlog, one board, and a workflow that fits each project.
					</p>

					<div className="flex flex-col items-center gap-3">
						<div className="flex flex-wrap justify-center gap-3">
							<Link href="/register" className={PRIMARY_LINK}>
								Get started free
								<ArrowRight className="size-4" aria-hidden />
							</Link>
							<Link href="/pricing" className={SECONDARY_LINK}>
								See pricing
							</Link>
						</div>
						<p className="text-xs text-muted">
							Free for teams of up to {PLAN_LIMITS.FREE.members}. No credit
							card needed.
						</p>
					</div>

					<BoardPreview className="mt-6 w-full max-w-4xl" />
				</div>
			</section>

			<section className="mx-auto max-w-6xl px-4 py-20">
				<div className="mx-auto mb-12 flex max-w-2xl flex-col gap-3 text-center">
					<h2 className="text-3xl font-semibold tracking-tight">
						Everything a sprint needs, nothing it doesn&apos;t
					</h2>
					<p className="text-muted">
						The tools your team reaches for every day, without the setup
						project.
					</p>
				</div>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{FEATURES.map(({ icon: Icon, title, description }) => (
						<div
							key={title}
							className="group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-6 transition-all hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5"
						>
							<span className="flex size-10 items-center justify-center rounded-xl bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
								<Icon className="size-5" aria-hidden />
							</span>
							<h3 className="font-semibold">{title}</h3>
							<p className="text-sm text-muted">{description}</p>
						</div>
					))}
				</div>
			</section>

			<section className="border-y border-border bg-surface-secondary/50">
				<div className="mx-auto max-w-6xl px-4 py-20">
					<h2 className="mb-12 text-center text-3xl font-semibold tracking-tight">
						Up and running in minutes
					</h2>
					<ol className="grid gap-8 sm:grid-cols-3">
						{STEPS.map((step, i) => (
							<li key={step.title} className="flex flex-col gap-3">
								<span className="flex size-10 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
									{i + 1}
								</span>
								<h3 className="font-semibold">{step.title}</h3>
								<p className="text-sm text-muted">{step.description}</p>
							</li>
						))}
					</ol>
				</div>
			</section>

			<section className="mx-auto max-w-6xl px-4 py-20">
				<div className="brand-panel relative flex flex-col items-center gap-6 overflow-hidden rounded-3xl px-6 py-16 text-center text-accent-foreground">
					<h2 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
						Ready to forge your next sprint?
					</h2>
					<p className="max-w-xl text-accent-foreground/80">
						Create a workspace, invite your team and plan your first sprint
						today.
					</p>
					<Link
						href="/register"
						className="inline-flex items-center gap-2 rounded-lg bg-accent-foreground px-5 py-2.5 text-sm font-semibold text-accent shadow-lg transition-transform hover:scale-[1.03]"
					>
						Get started free
						<ArrowRight className="size-4" aria-hidden />
					</Link>
				</div>
			</section>
		</>
	);
}
