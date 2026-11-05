/**
 * The frame for the Terms and Privacy pages: title, date and the prose
 * styles their sections rely on (headings, lists, links).
 */
export default function LegalPage({
	title,
	lastUpdated,
	intro,
	children,
}: {
	title: string;
	lastUpdated: string;
	intro?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<article className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-12">
			<header className="flex flex-col gap-2">
				<h1 className="text-3xl font-semibold">{title}</h1>
				<p className="text-sm text-muted">Last updated: {lastUpdated}</p>
				{intro && <p className="text-sm leading-relaxed">{intro}</p>}
			</header>
			<div className="flex flex-col gap-8 text-sm leading-relaxed [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:font-medium [&_h3]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_section]:flex [&_section]:flex-col [&_section]:gap-3 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
				{children}
			</div>
		</article>
	);
}
