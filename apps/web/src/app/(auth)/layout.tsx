import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";

import BrandLink from "@/components/ui/brand-link";
import { ThemeSwitcher } from "@/components/theme-switch/theme-switch";
import BoardPreview from "@/features/marketing/components/BoardPreview";
import { FOOTER_LINKS } from "@/features/marketing/constants";

const HIGHLIGHTS = [
	"Plan sprints from a real backlog",
	"A workflow that fits each project",
	"Roles that give everyone the right access",
];

/**
 * Layout for the auth routes (/login, /register, /verify-email): the form on
 * the left under a header that leads back to the public site, and a brand
 * panel on the right from `lg` up. The `(auth)` route group keeps these pages
 * out of the dashboard shell without affecting the URL.
 */
export default function AuthLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
			<div className="flex flex-col">
				<header className="flex h-16 items-center justify-between gap-4 px-6">
					<BrandLink href="/" />
					<div className="flex items-center gap-2">
						<Link
							href="/"
							className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
						>
							<ArrowLeft className="size-4" aria-hidden />
							Back to home
						</Link>
						<ThemeSwitcher />
					</div>
				</header>

				<main className="flex flex-1 items-center justify-center px-6 py-10">
					<div className="w-full max-w-sm">{children}</div>
				</main>

				<footer className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 text-xs text-muted">
					<p>© {new Date().getFullYear()} TaskForge</p>
					<nav className="flex gap-4">
						{FOOTER_LINKS.map((link) => (
							<Link
								key={link.href}
								href={link.href}
								className="hover:text-foreground"
							>
								{link.label}
							</Link>
						))}
					</nav>
				</footer>
			</div>

			<aside className="brand-panel relative hidden overflow-hidden text-accent-foreground lg:flex lg:flex-col lg:justify-center lg:gap-10 lg:px-14 lg:py-16">
				<div className="flex max-w-md flex-col gap-4">
					<h2 className="text-4xl font-semibold leading-tight tracking-tight">
						Every sprint, from backlog to done.
					</h2>
					<ul className="flex flex-col gap-2.5">
						{HIGHLIGHTS.map((item) => (
							<li key={item} className="flex items-center gap-2.5 text-sm">
								<span className="flex size-5 items-center justify-center rounded-full bg-accent-foreground/20">
									<Check className="size-3" aria-hidden />
								</span>
								{item}
							</li>
						))}
					</ul>
				</div>
				{/* Bleeds off the right edge, like a window behind the form. */}
				<BoardPreview className="w-160 max-w-none -rotate-2 text-foreground" />
			</aside>
		</div>
	);
}
