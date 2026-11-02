"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@heroui/react";
import { ArrowLeft, Building2, LayoutDashboard, Users } from "lucide-react";

import BrandLink from "@/components/ui/brand-link";

import type { PlatformRole } from "../types/admin-types";
import { PlatformRoleChip } from "./admin-chips";

const ADMIN_NAV = [
	{ href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
	{ href: "/admin/workspaces", label: "Workspaces", icon: Building2 },
	{ href: "/admin/users", label: "Users", icon: Users },
];

/**
 * The admin console's chrome: brand, the viewer's platform role, the console's
 * tabs and a way back to the app. Deliberately outside the dashboard shell —
 * there is no workspace here (no `WorkspaceProvider`), the data is
 * platform-wide.
 */
export default function AdminShell({
	platformRole,
	children,
}: {
	platformRole: PlatformRole;
	children: React.ReactNode;
}) {
	const pathname = usePathname();

	return (
		<div className="flex min-h-dvh flex-col bg-background text-foreground">
			<header className="border-b border-border bg-surface">
				<div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-4">
					<BrandLink href="/admin" />
					<span className="text-sm text-muted" aria-hidden>
						/
					</span>
					<span className="text-sm font-medium">Platform admin</span>
					<PlatformRoleChip role={platformRole} />
					<Link
						href="/dashboard"
						className="ml-auto flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
					>
						<ArrowLeft className="size-4" aria-hidden />
						<span className="hidden sm:inline">Back to app</span>
						<span className="sm:hidden">App</span>
					</Link>
				</div>
				<nav
					aria-label="Admin"
					className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-4"
				>
					{ADMIN_NAV.map(({ href, label, icon: Icon, exact }) => {
						const isActive = exact
							? pathname === href
							: pathname === href || pathname.startsWith(`${href}/`);
						return (
							<Link
								key={href}
								href={href}
								aria-current={isActive ? "page" : undefined}
								className={cn(
									"flex shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
									isActive
										? "border-accent text-foreground"
										: "border-transparent text-muted hover:text-foreground",
								)}
							>
								<Icon className="size-4" aria-hidden />
								{label}
							</Link>
						);
					})}
				</nav>
			</header>

			<main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
				{children}
			</main>
		</div>
	);
}
