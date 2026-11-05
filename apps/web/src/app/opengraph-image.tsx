import { ImageResponse } from "next/og";

import { SITE_NAME } from "@/lib/seo";

/**
 * The share card for every page (Slack, LinkedIn, X…), generated at build
 * time. X falls back to it for its card, so there is no `twitter-image`.
 * `proxy.ts` lets this route through without a session.
 *
 * Colors are hex approximations of the theme's `--accent` and dark
 * `--background` (`globals.css` uses oklch, which the image renderer doesn't).
 */
export const alt = `${SITE_NAME}: plan, track and ship work as a team`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ACCENT = "#545cea";
const BACKGROUND = "#0b0c12";
const MUTED = "#a1a3b5";

// lucide's Anvil, the mark in `BrandLink`.
const ANVIL_PATHS = [
	"M7 10H6a4 4 0 0 1-4-4 1 1 0 0 1 1-1h4",
	"M7 5a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1 7 7 0 0 1-7 7H8a1 1 0 0 1-1-1z",
	"M9 12v5",
	"M15 12v5",
	"M5 20a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3 1 1 0 0 1-1 1H6a1 1 0 0 1-1-1",
];

export default function OpengraphImage() {
	return new ImageResponse(
		(
			<div
				style={{
					width: "100%",
					height: "100%",
					display: "flex",
					flexDirection: "column",
					justifyContent: "space-between",
					padding: 80,
					background: `radial-gradient(circle at 85% 15%, ${ACCENT}55, ${BACKGROUND} 55%)`,
					color: "white",
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: 20 }}>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							width: 72,
							height: 72,
							borderRadius: 18,
							background: ACCENT,
						}}
					>
						<svg
							width="40"
							height="40"
							viewBox="0 0 24 24"
							fill="none"
							stroke="white"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							{ANVIL_PATHS.map((d) => (
								<path key={d} d={d} />
							))}
						</svg>
					</div>
					<div style={{ fontSize: 40, fontWeight: 600 }}>{SITE_NAME}</div>
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
					<div
						style={{
							fontSize: 72,
							fontWeight: 700,
							lineHeight: 1.1,
							letterSpacing: -2,
							maxWidth: 900,
						}}
					>
						Plan, track and ship work as a team
					</div>
					<div style={{ fontSize: 32, color: MUTED, maxWidth: 900 }}>
						Sprints, boards, custom workflows and roles, in one issue
						tracker.
					</div>
				</div>
			</div>
		),
		size,
	);
}
