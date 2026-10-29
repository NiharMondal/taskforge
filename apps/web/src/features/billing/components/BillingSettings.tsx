"use client";

import { useEffect, useRef, useState } from "react";

import {
	Alert,
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Chip,
	Label,
	Meter,
	Spinner,
	toast,
} from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import { PLAN_LIMITS } from "@taskforge/shared";
import { Check, CreditCard, Mail, Sparkles } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import ErrorAlert from "@/components/ui/error-alert";
import { useWorkspacePermissions } from "@/features/memberships/hooks/use-workspace-permissions";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { workspaceKeys } from "@/features/workspace/hooks/use-workspaces";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatDate } from "@/util/format-date";

import {
	ACTIVATION_POLL_MS,
	ACTIVATION_TIMEOUT_MS,
	PLAN_META,
	PLAN_ORDER,
	SALES_EMAIL,
	STATUS_LABELS,
} from "../constants";
import {
	useBilling,
	useOpenPortal,
	useStartCheckout,
} from "../hooks/use-billing";
import { seatUsage } from "../lib/plan-limit";
import type { Billing, SubscriptionPlan } from "../types/billing-types";

const longDate = (iso: string | null) => formatDate(iso ?? "", "MMMM dd, yyyy");

/**
 * Settings → Billing (`GET /billing`). Everyone sees the plan and how close
 * the workspace is to its limits; the owner (`billing:manage`) upgrades
 * through Stripe Checkout and manages the card, invoices and cancellation in
 * Stripe's portal. The plan changes only when Stripe's webhook reaches the
 * backend, so on the way back from checkout (`?checkout=success`) the page
 * polls until it does.
 */
export default function BillingSettings() {
	const { activeWorkspaceId } = useWorkspace();
	const workspaceId = activeWorkspaceId ?? "";
	const { canManageBilling } = useWorkspacePermissions();

	const searchParams = useSearchParams();
	const router = useRouter();
	const pathname = usePathname();
	const queryClient = useQueryClient();
	const returnedFromCheckout = searchParams.get("checkout") === "success";

	const [timedOut, setTimedOut] = useState(false);
	// Waiting for the webhook lasts as long as `?checkout=success` is in the URL.
	const isActivating = returnedFromCheckout;
	const announced = useRef(false);
	const {
		data: billing,
		isLoading,
		isError,
		error,
		refetch,
	} = useBilling(workspaceId, {
		refetchInterval: isActivating && !timedOut ? ACTIVATION_POLL_MS : false,
	});

	useEffect(() => {
		if (!isActivating) return;
		const timer = setTimeout(() => setTimedOut(true), ACTIVATION_TIMEOUT_MS);
		return () => clearTimeout(timer);
	}, [isActivating]);

	// The webhook landed: refresh the switcher's badges and drop `?checkout`,
	// which stops the polling and keeps a reload from waiting again.
	useEffect(() => {
		if (!isActivating || !billing || billing.plan === "FREE") return;
		if (announced.current) return;
		announced.current = true;
		toast.success(`${PLAN_META[billing.plan].name} is active. Thank you!`);
		queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
		router.replace(pathname);
	}, [isActivating, billing, queryClient, router, pathname]);

	const { mutateAsync: checkout, isPending: isCheckingOut } =
		useStartCheckout(workspaceId);
	const { mutateAsync: portal, isPending: isOpeningPortal } =
		useOpenPortal(workspaceId);

	/** Both lead to a Stripe-hosted page; card details never touch TaskForge. */
	const goTo = async (open: () => Promise<{ url: string }>, what: string) => {
		try {
			const { url } = await open();
			window.location.assign(url);
		} catch (err) {
			toast.danger(getApiErrorMessage(err, `Couldn’t open ${what}`));
		}
	};
	const upgrade = () => goTo(checkout, "checkout");
	const manage = () => goTo(portal, "the billing portal");

	if (isError) {
		return (
			<ErrorAlert
				title="Couldn’t load billing"
				description={getApiErrorMessage(error, "Please try again.")}
				onRetry={() => refetch()}
			/>
		);
	}

	if (isLoading || !billing) {
		return (
			<div className="flex items-center justify-center py-12">
				<Spinner />
			</div>
		);
	}

	const manageButton = canManageBilling && billing.hasBillingAccount && (
		<Button
			size="sm"
			variant="outline"
			onPress={manage}
			isPending={isOpeningPortal}
		>
			<CreditCard className="size-4" />
			Manage billing
		</Button>
	);

	return (
		<div className="flex flex-col gap-6">
			<BillingBanners
				billing={billing}
				isActivating={isActivating && billing.plan === "FREE"}
				timedOut={timedOut}
				canManageBilling={canManageBilling}
				onManage={manage}
			/>

			<Card>
				<CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
					<div className="flex flex-col gap-1">
						<CardTitle className="flex items-center gap-2">
							{PLAN_META[billing.plan].name} plan
							{billing.status && billing.plan !== "FREE" && (
								<Chip
									size="sm"
									variant="soft"
									color={
										billing.status === "PAST_DUE"
											? "danger"
											: billing.status === "TRIALING"
												? "accent"
												: "success"
									}
								>
									{STATUS_LABELS[billing.status]}
								</Chip>
							)}
						</CardTitle>
						<CardDescription>
							<PlanPeriod billing={billing} />
						</CardDescription>
					</div>
					{manageButton}
				</CardHeader>
				<CardContent>
					<Usage billing={billing} />
				</CardContent>
			</Card>

			<div className="grid gap-4 lg:grid-cols-3">
				{PLAN_ORDER.map((plan) => (
					<PlanCard
						key={plan}
						plan={plan}
						billing={billing}
						action={
							<PlanAction
								plan={plan}
								billing={billing}
								canManageBilling={canManageBilling}
								onUpgrade={upgrade}
								isUpgrading={isCheckingOut}
							/>
						}
					/>
				))}
			</div>
		</div>
	);
}

/** Renewal, trial or end date, in one line. */
function PlanPeriod({ billing }: { billing: Billing }) {
	if (billing.plan === "FREE") {
		return "Your workspace is on the Free plan.";
	}
	if (!billing.currentPeriodEnd) {
		return "Your workspace is on a paid plan.";
	}
	if (billing.cancelAtPeriodEnd) {
		return `Ends on ${longDate(billing.currentPeriodEnd)}.`;
	}
	if (billing.status === "TRIALING" && billing.trialEndsAt) {
		return `Trial ends on ${longDate(billing.trialEndsAt)}; billing starts then.`;
	}
	const seats = billing.seats
		? ` for ${billing.seats} ${billing.seats === 1 ? "member" : "members"}`
		: "";
	return `Renews on ${longDate(billing.currentPeriodEnd)}${seats}.`;
}

function Usage({ billing }: { billing: Billing }) {
	const { used, limit, isFull } = seatUsage(billing);

	return (
		<div className="flex flex-col gap-4">
			{limit === null ? (
				<p className="text-sm">
					<span className="font-medium">{used}</span>{" "}
					<span className="text-muted">
						members and pending invitations · unlimited
					</span>
				</p>
			) : (
				<Meter
					value={Math.min(used, limit)}
					maxValue={limit}
					color={isFull ? "warning" : "accent"}
					// The default output is a percentage; seats read better.
					valueLabel={`${used} of ${limit}`}
				>
					<Label>Members and pending invitations</Label>
					<Meter.Output />
					<Meter.Track>
						<Meter.Fill />
					</Meter.Track>
				</Meter>
			)}
			<p className="text-sm">
				<span className="text-muted">Custom roles: </span>
				{billing.limits.customRoles ? "included" : "Pro only"}
			</p>
			<p className="text-sm">
				<span className="text-muted">Custom workflows: </span>
				{billing.limits.customWorkflows ? "included" : "Pro only"}
			</p>
		</div>
	);
}

function PlanCard({
	plan,
	billing,
	action,
}: {
	plan: SubscriptionPlan;
	billing: Billing;
	action: React.ReactNode;
}) {
	const meta = PLAN_META[plan];
	const isCurrent = billing.plan === plan;

	return (
		<Card className={isCurrent ? "ring-2 ring-accent" : undefined}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					{meta.name}
					{isCurrent && (
						<Chip size="sm" variant="soft" color="accent">
							Current
						</Chip>
					)}
				</CardTitle>
				<CardDescription>{meta.tagline}</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-1 flex-col gap-4">
				<p className="text-lg font-semibold">{meta.price}</p>
				<ul className="flex flex-1 flex-col gap-2">
					{meta.features.map((feature) => (
						<li key={feature} className="flex gap-2 text-sm">
							<Check className="mt-0.5 size-4 shrink-0 text-success" />
							{feature}
						</li>
					))}
				</ul>
				{action}
			</CardContent>
		</Card>
	);
}

/** What a plan card offers this viewer. */
function PlanAction({
	plan,
	billing,
	canManageBilling,
	onUpgrade,
	isUpgrading,
}: {
	plan: SubscriptionPlan;
	billing: Billing;
	canManageBilling: boolean;
	onUpgrade: () => void;
	isUpgrading: boolean;
}) {
	if (plan === "ENTERPRISE") {
		if (billing.plan === "ENTERPRISE" || !SALES_EMAIL) return null;
		return (
			<a
				href={`mailto:${SALES_EMAIL}?subject=${encodeURIComponent("TaskForge Enterprise")}`}
				className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
			>
				<Mail className="size-4" />
				Contact us
			</a>
		);
	}

	if (plan !== "PRO" || billing.plan !== "FREE") return null;

	if (!canManageBilling) {
		return (
			<p className="text-sm text-muted">
				Ask the workspace owner to upgrade.
			</p>
		);
	}
	if (!billing.billingEnabled) {
		return (
			<p className="text-sm text-muted">
				Billing isn’t set up on this server yet.
			</p>
		);
	}
	return (
		<Button onPress={onUpgrade} isPending={isUpgrading} fullWidth>
			<Sparkles className="size-4" />
			{billing.trialAvailable ? "Start free trial" : "Upgrade to Pro"}
		</Button>
	);
}

function BillingBanners({
	billing,
	isActivating,
	timedOut,
	canManageBilling,
	onManage,
}: {
	billing: Billing;
	isActivating: boolean;
	timedOut: boolean;
	canManageBilling: boolean;
	onManage: () => void;
}) {
	if (isActivating) {
		return timedOut ? (
			<Alert status="warning">
				<Alert.Indicator />
				<Alert.Content>
					<Alert.Title>Still activating Pro</Alert.Title>
					<Alert.Description>
						Stripe hasn’t confirmed the payment yet. Refresh this page in a
						minute; you won’t be charged twice.
					</Alert.Description>
				</Alert.Content>
			</Alert>
		) : (
			<Alert status="accent">
				<Alert.Indicator>
					<Spinner size="sm" />
				</Alert.Indicator>
				<Alert.Content>
					<Alert.Title>Activating Pro…</Alert.Title>
					<Alert.Description>
						Waiting for Stripe to confirm your subscription.
					</Alert.Description>
				</Alert.Content>
			</Alert>
		);
	}

	if (billing.status === "PAST_DUE") {
		return (
			<Alert status="danger">
				<Alert.Indicator />
				<Alert.Content>
					<Alert.Title>Payment failed</Alert.Title>
					<Alert.Description>
						{canManageBilling
							? "Stripe will retry the card for a while. Update your payment method to keep Pro."
							: "Stripe will retry the card for a while. The workspace owner needs to update the payment method to keep Pro."}
					</Alert.Description>
					{canManageBilling && (
						<Button
							size="sm"
							variant="outline"
							className="mt-2 w-fit"
							onPress={onManage}
						>
							Update card
						</Button>
					)}
				</Alert.Content>
			</Alert>
		);
	}

	if (billing.plan !== "FREE" && billing.cancelAtPeriodEnd) {
		return (
			<Alert status="warning">
				<Alert.Indicator />
				<Alert.Content>
					<Alert.Title>
						Pro ends on {longDate(billing.currentPeriodEnd)}
					</Alert.Title>
					<Alert.Description>
						The workspace then returns to Free. Nothing is deleted and
						nobody is removed, but invitations stop past{" "}
						{PLAN_LIMITS.FREE.members} members and no new custom roles can
						be created.
					</Alert.Description>
				</Alert.Content>
			</Alert>
		);
	}

	return null;
}
