import type {
	AuthProvider as SignInProvider,
	PlatformAuditAction,
	PlatformAuditMetadata,
	PlatformAuditTargetType,
	PlatformRole,
	SubscriptionPlan,
	SubscriptionStatus,
	WorkspaceRole,
} from "@taskforge/shared";

/**
 * The platform admin console's contract: `GET /admin/*`
 * (apps/backend/src/modules/admin/, `apps/backend/spec/admin-spec.md`).
 * Platform-wide, so nothing here carries a workspace id of its own.
 */
export type {
	PlatformAuditAction,
	PlatformAuditMetadata,
	PlatformAuditTargetType,
	PlatformRole,
	SignInProvider,
};

/**
 * A suspension by platform staff, as only the /admin routes return it.
 * `suspendedReason` is the staff's internal note; the user never sees it.
 */
export interface AdminSuspension {
	suspendedAt: string | null;
	suspendedReason: string | null;
}

/** `GET /admin/stats`. */
export interface AdminStats {
	users: {
		total: number;
		newLast7Days: number;
		newLast30Days: number;
		platformStaff: number;
		suspended: number;
	};
	workspaces: {
		total: number;
		/** By the plan in force (a lapsed subscription counts as Free). */
		byPlan: Record<SubscriptionPlan, number>;
		suspended: number;
	};
	subscriptions: {
		/** Workspaces with a subscription row (a checkout was started). */
		total: number;
		byStatus: Record<SubscriptionStatus, number>;
		/** A checkout was started but nothing was subscribed. */
		noStatus: number;
	};
}

export interface AdminUserSummary {
	id: string;
	name: string;
	email: string;
}

/** A workspace role as the admin routes embed it. */
export interface AdminRoleSummary {
	id: string;
	name: string;
	systemKey: WorkspaceRole | null;
}

/** One row of `GET /admin/workspaces`. */
export interface AdminWorkspaceRow extends AdminSuspension {
	id: string;
	name: string;
	slug: string;
	createdAt: string;
	owner: AdminUserSummary | null;
	memberCount: number;
	/** The plan in force now. */
	plan: SubscriptionPlan;
	subscription: {
		/** The stored plan; may not be in force (see `status`). */
		plan: SubscriptionPlan;
		status: SubscriptionStatus | null;
		seats: number | null;
		cancelAtPeriodEnd: boolean;
		currentPeriodEnd: string | null;
	} | null;
}

/** `GET /admin/workspaces/:id`. */
export interface AdminWorkspaceDetail extends AdminSuspension {
	id: string;
	name: string;
	slug: string;
	description: string | null;
	createdAt: string;
	updatedAt: string;
	plan: SubscriptionPlan;
	owner: AdminUserSummary | null;
	subscription: {
		plan: SubscriptionPlan;
		status: SubscriptionStatus | null;
		stripeCustomerId: string | null;
		stripeSubscriptionId: string | null;
		seats: number | null;
		currentPeriodEnd: string | null;
		cancelAtPeriodEnd: boolean;
		trialEndsAt: string | null;
		createdAt: string;
		updatedAt: string;
	} | null;
	/** Which Stripe mode the ids belong to; null when the backend has no key. */
	stripeMode: "test" | "live" | null;
	counts: {
		members: number;
		projects: number;
		issues: number;
		sprints: number;
		labels: number;
		customRoles: number;
		pendingInvitations: number;
	};
	/** At most `ADMIN_DETAIL_LIST_LIMIT`, oldest first; `counts.members` is the total. */
	members: {
		id: string;
		role: WorkspaceRole;
		assignedRole: AdminRoleSummary | null;
		isOwner: boolean;
		joinedAt: string;
		user: AdminUserSummary & { avatarUrl: string | null };
	}[];
	/** At most `ADMIN_DETAIL_LIST_LIMIT`, oldest first; `counts.projects` is the total. */
	projects: {
		id: string;
		name: string;
		key: string;
		createdAt: string;
		issueCount: number;
		sprintCount: number;
	}[];
}

/** One row of `GET /admin/users`. */
export interface AdminUserRow extends AdminSuspension {
	id: string;
	name: string;
	email: string;
	avatarUrl: string | null;
	emailVerifiedAt: string | null;
	platformRole: PlatformRole | null;
	createdAt: string;
	signInMethods: SignInProvider[];
	workspaceCount: number;
}

/** `GET /admin/users/:id`. Never a password hash or a token. */
export interface AdminUserDetail extends AdminSuspension {
	id: string;
	name: string;
	email: string;
	avatarUrl: string | null;
	emailVerifiedAt: string | null;
	platformRole: PlatformRole | null;
	createdAt: string;
	updatedAt: string;
	signInMethods: { provider: SignInProvider; addedAt: string }[];
	counts: {
		workspaces: number;
		reportedIssues: number;
		assignedIssues: number;
		comments: number;
		/** Signed-in devices or browsers (refresh tokens still usable). */
		activeSessions: number;
	};
	/** At most `ADMIN_DETAIL_LIST_LIMIT`, oldest first; `counts.workspaces` is the total. */
	memberships: {
		id: string;
		role: WorkspaceRole;
		assignedRole: AdminRoleSummary | null;
		isOwner: boolean;
		joinedAt: string;
		workspace: {
			id: string;
			name: string;
			plan: SubscriptionPlan;
			memberCount: number;
		};
	}[];
}

/** `?search=&page=` on `GET /admin/users`. */
export interface AdminUsersQuery {
	search?: string;
	page?: number;
	limit?: number;
}

/** `?search=&plan=&page=` on `GET /admin/workspaces`. */
export interface AdminWorkspacesQuery extends AdminUsersQuery {
	plan?: SubscriptionPlan;
}

/** Who is looking at the console: from `GET /users/me`, read by the admin layout. */
export interface AdminViewer {
	id: string;
	platformRole: PlatformRole;
}

/** Body of `PATCH /admin/users/:id` and `PATCH /admin/workspaces/:id`. */
export interface SetSuspendedDto {
	suspended: boolean;
	reason: string;
}

/** Body of every other admin action: why. */
export interface AdminReasonDto {
	reason: string;
}

interface PlatformAuditEntryBase<A extends PlatformAuditAction> {
	id: string;
	action: A;
	targetType: PlatformAuditTargetType;
	targetId: string | null;
	metadata: PlatformAuditMetadata[A];
	createdAt: string;
	/** Platform staff who did it; `null` for the `set-platform-role` script or a deleted account. */
	actor: { id: string; name: string; email: string } | null;
}

/**
 * One row of `GET /admin/audit-log`. A union over the actions, so switching
 * on `action` narrows `metadata`. Names are copied in when it happened, so a
 * deleted user or workspace still reads.
 */
export type PlatformAuditEntry = {
	[A in PlatformAuditAction]: PlatformAuditEntryBase<A>;
}[PlatformAuditAction];

/** `?targetType=&targetId=&page=` on `GET /admin/audit-log`. */
export interface PlatformAuditQuery {
	targetType?: PlatformAuditTargetType;
	targetId?: string;
	page?: number;
	limit?: number;
}
