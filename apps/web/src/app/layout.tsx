import { Providers } from "@/provider";
import { Toast } from "@heroui/react";
import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";

import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo";
import "./globals.css";

const inter = Inter({
	variable: "--font-inter",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

/**
 * Defaults for every route. Pages are kept out of search engines unless they
 * opt in: the public pages do, through `publicPageMetadata` (`lib/seo.ts`).
 * The app's own pages only set a short `title`, shown as "Projects · TaskForge".
 */
export const metadata: Metadata = {
	metadataBase: SITE_URL,
	applicationName: SITE_NAME,
	title: {
		default: SITE_NAME,
		template: `%s · ${SITE_NAME}`,
	},
	description: SITE_DESCRIPTION,
	robots: { index: false, follow: false },
	openGraph: {
		type: "website",
		siteName: SITE_NAME,
		locale: "en_US",
		title: SITE_NAME,
		description: SITE_DESCRIPTION,
	},
	twitter: {
		card: "summary_large_image",
		title: SITE_NAME,
		description: SITE_DESCRIPTION,
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			suppressHydrationWarning
			className={`${inter.variable} ${geistMono.variable} h-full antialiased`}
		>
			<body className="bg-background text-foreground">
				<Toast.Provider placement="top" />
				<Providers>{children}</Providers>
			</body>
		</html>
	);
}
