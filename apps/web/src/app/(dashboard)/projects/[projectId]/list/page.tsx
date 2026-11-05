import type { Metadata } from "next";

import IssuesView from "@/features/issues/components/IssuesView";

export const metadata: Metadata = { title: "Issues" };

/**
 * Every issue in the project as a filterable table: `/projects/[projectId]/list`.
 * The view is a client component (it owns modal and query state).
 * A server page so it can set the tab title.
 */
export default async function ProjectIssuesPage({
	params,
}: PageProps<"/projects/[projectId]/list">) {
	const { projectId } = await params;
	return <IssuesView projectId={projectId} />;
}
