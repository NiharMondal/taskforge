import Link from "next/link";

import BrandLink from "@/components/ui/brand-link";
import { ThemeSwitcher } from "@/components/theme-switch/theme-switch";

import { GHOST_LINK, PRIMARY_LINK } from "../constants";

/**
 * The public site's header. It doesn't read the session: a signed-in visitor
 * who follows "Sign in" is sent on to the dashboard by `proxy.ts`.
 */
export default function MarketingHeader() {
	return (
		<header className="border-b border-border">
			<div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
				<div className="flex items-center gap-6">
					<BrandLink href="/" />
					<nav className="text-sm">
						<Link href="/pricing" className="text-muted hover:text-foreground">
							Pricing
						</Link>
					</nav>
				</div>
				<div className="flex items-center gap-2">
					<ThemeSwitcher />
					<Link href="/login" className={GHOST_LINK}>
						Sign in
					</Link>
					<Link href="/register" className={PRIMARY_LINK}>
						Get started
					</Link>
				</div>
			</div>
		</header>
	);
}
