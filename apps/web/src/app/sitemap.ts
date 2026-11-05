import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/seo";

/**
 * `/sitemap.xml`: the indexable pages, i.e. the ones whose metadata comes from
 * `publicPageMetadata`. Add a page here when you add one there.
 * `proxy.ts` lets this route through without a session.
 */
const PAGES: { path: string; priority: number }[] = [
	{ path: "/", priority: 1 },
	{ path: "/pricing", priority: 0.8 },
	{ path: "/register", priority: 0.6 },
	{ path: "/login", priority: 0.4 },
	{ path: "/terms", priority: 0.2 },
	{ path: "/privacy", priority: 0.2 },
];

export default function sitemap(): MetadataRoute.Sitemap {
	return PAGES.map(({ path, priority }) => ({
		url: new URL(path, SITE_URL).href,
		changeFrequency: "monthly",
		priority,
	}));
}
