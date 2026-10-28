import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";

export type BreadcrumbItem = {
	label: string;
	/** Omit on the last item: it is the current page and renders as plain text. */
	href?: string;
};

/**
 * Trail of links such as `Projects › Alpha › Board`. Built on `next/link`
 * rather than HeroUI's `Breadcrumbs`, whose react-aria links do a full page
 * load without a `RouterProvider`.
 */
export default function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
	return (
		<nav aria-label="Breadcrumb">
			<ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
				{items.map((item, index) => {
					const isLast = index === items.length - 1;
					return (
						<Fragment key={`${index}-${item.label}`}>
							<li className="min-w-0">
								{item.href && !isLast ? (
									<Link
										href={item.href}
										className="transition-colors hover:text-foreground"
									>
										{item.label}
									</Link>
								) : (
									<span
										aria-current={isLast ? "page" : undefined}
										className="block truncate font-medium text-foreground"
									>
										{item.label}
									</span>
								)}
							</li>
							{!isLast && (
								<li aria-hidden="true" className="flex">
									<ChevronRight className="h-4 w-4" />
								</li>
							)}
						</Fragment>
					);
				})}
			</ol>
		</nav>
	);
}
