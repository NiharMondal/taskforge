import BackButton from "@/components/ui/back-button";
import IssueDetailComponent from "@/features/issues/components/IssueDetailComponent";

type TSlug = {
	projectId: string;
	slug: string;
};

export default async function IssueDetailPage({
	params,
}: {
	params: Promise<TSlug>;
}) {
	const { projectId, slug } = await params;
	return (
		<div className="flex flex-col gap-4">
			<BackButton href={`/projects/${projectId}/issues`} label="Issues" />
			<IssueDetailComponent projectId={projectId} issueId={slug} />
		</div>
	);
}
