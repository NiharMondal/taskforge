import { Providers } from "@/provider";
import { Toast } from "@heroui/react";
import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
	variable: "--font-inter",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Task Forge",
	description:
		"TaskForge is a task management tool that helps you manage your tasks and projects.",
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
				<Providers>
					<Toast.Provider placement="top" />
					{children}
				</Providers>
			</body>
		</html>
	);
}
