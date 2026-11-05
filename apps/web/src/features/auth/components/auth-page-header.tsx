/** The title block at the top of each auth page. */
export default function AuthPageHeader({
	title,
	description,
}: {
	title: string;
	description: React.ReactNode;
}) {
	return (
		<div className="mb-8 flex flex-col gap-2">
			<h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
			<p className="text-sm text-muted">{description}</p>
		</div>
	);
}
