import { cn } from "@heroui/react";

type Tone = "accent" | "warning" | "success" | "danger";

const LABEL_TONES: Record<Tone, string> = {
	accent: "bg-accent/12 text-accent",
	warning: "bg-warning/20 text-warning-foreground dark:text-warning",
	success: "bg-success/20 text-success-foreground dark:text-success",
	danger: "bg-danger/12 text-danger",
};

/** One color per (made-up) teammate, so the same initials match across cards. */
const AVATAR_TONES: Record<string, string> = {
	AL: "bg-accent text-accent-foreground",
	GH: "bg-success text-success-foreground",
	KJ: "bg-warning text-warning-foreground",
};

interface PreviewCard {
	key: string;
	title: string;
	label: { name: string; tone: Tone };
	assignee: string;
	points?: number;
}

const COLUMNS: {
	name: string;
	dot: string;
	cards: PreviewCard[];
	className?: string;
}[] = [
	{
		name: "To do",
		dot: "bg-muted",
		cards: [
			{
				key: "WEB-24",
				title: "Onboarding checklist",
				label: { name: "Design", tone: "accent" },
				assignee: "AL",
				points: 3,
			},
			{
				key: "API-31",
				title: "Rate-limit public routes",
				label: { name: "Backend", tone: "warning" },
				assignee: "GH",
			},
		],
	},
	{
		name: "In progress",
		dot: "bg-accent",
		cards: [
			{
				key: "WEB-19",
				title: "Drag cards between lanes",
				label: { name: "Frontend", tone: "accent" },
				assignee: "KJ",
				points: 5,
			},
			{
				key: "API-27",
				title: "Fix flaky invite test",
				label: { name: "Bug", tone: "danger" },
				assignee: "AL",
			},
		],
	},
	{
		name: "Done",
		dot: "bg-success",
		// Two columns fit a phone; the third joins from `sm` up.
		className: "hidden sm:flex",
		cards: [
			{
				key: "API-12",
				title: "Stripe checkout",
				label: { name: "Billing", tone: "success" },
				assignee: "GH",
				points: 8,
			},
		],
	},
];

/**
 * A static, decorative picture of a sprint board for the public pages: not
 * real data, and hidden from screen readers.
 */
export default function BoardPreview({ className }: { className?: string }) {
	return (
		<div
			aria-hidden
			className={cn(
				"rounded-2xl border border-border bg-surface/80 p-3 shadow-2xl shadow-accent/10 backdrop-blur",
				className,
			)}
		>
			<div className="mb-3 flex items-center justify-between px-1">
				<div className="flex items-center gap-2">
					<span className="size-2.5 rounded-full bg-danger/70" />
					<span className="size-2.5 rounded-full bg-warning/70" />
					<span className="size-2.5 rounded-full bg-success/70" />
				</div>
				<span className="rounded-full bg-accent/12 px-2 py-0.5 text-[10px] font-medium text-accent">
					Sprint 14 · 6 days left
				</span>
			</div>
			<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
				{COLUMNS.map((column) => (
					<div
						key={column.name}
						className={cn(
							"flex flex-col gap-2 rounded-xl bg-surface-secondary p-2",
							column.className,
						)}
					>
						<div className="flex items-center gap-1.5 px-1 text-[11px] font-medium text-muted">
							<span className={cn("size-2 rounded-full", column.dot)} />
							{column.name}
							<span className="ml-auto">{column.cards.length}</span>
						</div>
						{column.cards.map((card) => (
							<div
								key={card.key}
								className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-2.5 text-left shadow-sm"
							>
								<span className="text-[10px] font-medium text-muted">
									{card.key}
								</span>
								<span className="text-xs font-medium leading-snug text-foreground">
									{card.title}
								</span>
								<div className="flex items-center gap-1.5">
									<span
										className={cn(
											"whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium",
											LABEL_TONES[card.label.tone],
										)}
									>
										{card.label.name}
									</span>
									{card.points !== undefined && (
										<span className="whitespace-nowrap rounded bg-surface-tertiary px-1.5 py-0.5 text-[10px] text-muted">
											{card.points} pts
										</span>
									)}
									<span
										className={cn(
											"ml-auto flex size-5 items-center justify-center rounded-full text-[9px] font-semibold",
											AVATAR_TONES[card.assignee],
										)}
									>
										{card.assignee}
									</span>
								</div>
							</div>
						))}
					</div>
				))}
			</div>
		</div>
	);
}
