import type { Metadata } from "next";

export const SITE_NAME = "TaskForge";

export const SITE_DESCRIPTION =
	"TaskForge is an issue tracker for teams: plan sprints, move work across a board, shape each project's workflow and give everyone the right access.";

/**
 * The public site's origin, for canonical URLs, Open Graph, robots.txt and the
 * sitemap. `SITE_URL` when set (a custom domain), else the production domain
 * Vercel provides at build and run time, else local dev. Server-only: nothing
 * in the browser reads it, so it needs no `NEXT_PUBLIC_` prefix.
 */
export const SITE_URL = new URL(
	process.env.SITE_URL ??
		(process.env.VERCEL_PROJECT_PRODUCTION_URL
			? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
			: "http://localhost:3000"),
);

/**
 * Metadata for an indexable public page. Only the title and description differ
 * between pages; the rest is the same everywhere.
 *
 * Next merges metadata shallowly, so a page that sets `openGraph` replaces the
 * root layout's whole object: that is why this builds the complete one. The
 * share image comes from `app/opengraph-image.tsx`, which applies regardless.
 *
 * `title` goes through the root layout's "%s · TaskForge" template; pass
 * `absoluteTitle` for the landing page, whose title already names the product.
 */
export function publicPageMetadata({
	title,
	description,
	path,
	absoluteTitle = false,
}: {
	title: string;
	description: string;
	path: string;
	absoluteTitle?: boolean;
}): Metadata {
	const fullTitle = absoluteTitle ? title : `${title} · ${SITE_NAME}`;
	return {
		title: absoluteTitle ? { absolute: title } : title,
		description,
		alternates: { canonical: path },
		robots: { index: true, follow: true },
		openGraph: {
			type: "website",
			siteName: SITE_NAME,
			locale: "en_US",
			url: path,
			title: fullTitle,
			description,
		},
		twitter: {
			card: "summary_large_image",
			title: fullTitle,
			description,
		},
	};
}
