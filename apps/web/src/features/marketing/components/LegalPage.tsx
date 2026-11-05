import { Alert } from "@heroui/react";

/**
 * The frame for the Terms and Privacy pages. Their text is a placeholder until
 * the real policy is written, and says so on the page.
 */
export default function LegalPage({
	title,
	lastUpdated,
	children,
}: {
	title: string;
	lastUpdated: string;
	children: React.ReactNode;
}) {
	return (
		<article className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-12">
			<header className="flex flex-col gap-1">
				<h1 className="text-3xl font-semibold">{title}</h1>
				<p className="text-sm text-muted">Last updated: {lastUpdated}</p>
			</header>
			<Alert status="warning">
				<Alert.Indicator />
				<Alert.Content>
					<Alert.Title>Draft</Alert.Title>
					<Alert.Description>
						This is placeholder text, not the final policy. It will be replaced
						before TaskForge launches.
					</Alert.Description>
				</Alert.Content>
			</Alert>
			<div className="flex flex-col gap-6 text-sm leading-relaxed [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_section]:flex [&_section]:flex-col [&_section]:gap-2">
				{children}
			</div>
		</article>
	);
}
