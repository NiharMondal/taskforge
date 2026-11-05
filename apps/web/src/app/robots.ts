import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/seo";

/**
 * `/robots.txt`. Crawlers may read the public site; the app's own routes
 * redirect to sign-in for them anyway, so they're disallowed to save crawl
 * budget. The token pages (`/verify-email`, `/reset-password`,
 * `/forgot-password`) are left crawlable on purpose: their `noindex` meta tag
 * is what keeps them out of results, and a crawler can't read it if blocked.
 * `proxy.ts` lets this route through without a session.
 */
export default function robots(): MetadataRoute.Robots {
	return {
		rules: {
			userAgent: "*",
			allow: "/",
			disallow: [
				"/api/",
				"/admin",
				"/dashboard",
				"/invitations",
				"/issues",
				"/projects",
				"/settings",
			],
		},
		sitemap: new URL("/sitemap.xml", SITE_URL).href,
	};
}
