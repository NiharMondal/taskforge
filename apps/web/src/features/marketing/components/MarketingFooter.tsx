import Link from "next/link";

import { FOOTER_LINKS } from "../constants";

export default function MarketingFooter() {
	return (
		<footer className="border-t border-border">
			<div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 text-sm text-muted">
				<p>© {new Date().getFullYear()} TaskForge</p>
				<nav className="flex gap-6">
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
			</div>
		</footer>
	);
}
