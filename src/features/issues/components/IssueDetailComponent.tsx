"use client";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { useSingleIssue } from "../hooks/use-issues";
import IssueForm from "./IssueForm";
type Props = {
	projectId: string;
	issueId: string;
};
export default function IssueDetailComponent({ projectId, issueId }: Props) {
	const { activeWorkspaceId } = useWorkspace();
	const workspaceId = activeWorkspaceId ?? "";
	const { data: issue } = useSingleIssue(workspaceId, projectId, issueId);
	console.log(issue);
	return (
		<div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
			<div className="xl:col-span-4">
				<IssueForm
					isSubmitting={false}
					onSubmit={() => {}}
					members={[]}
				/>
			</div>
			<div className="flex flex-col gap-5">
				<div className="border p-3 rounded-md">
					Lorem ipsum dolor sit amet consectetur adipisicing elit. Cum
					aut, eius quidem praesentium facere est possimus debitis
					odio unde vero assumenda hic minima corporis ad pariatur
					inventore! Commodi a rerum provident assumenda facere,
					error, ex unde dolores quo earum reiciendis. Cumque ex
					fugiat neque tempore animi distinctio esse ullam sit.
				</div>
			</div>
		</div>
	);
}
