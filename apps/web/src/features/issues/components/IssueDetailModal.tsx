"use client";

import MyModal from "@/components/ui/my-modal";
import type { Permissions } from "@/features/memberships/lib/permissions";
import type { Member } from "@/features/memberships/types/membership-types";
import { useSprints } from "@/features/sprint/hooks/use-sprints";

import { useIssueEditor } from "../hooks/use-issue-editor";
import type { Issue } from "../types/issue-types";
import IssueContentForm from "./IssueContentForm";
import IssueDetailsPanel from "./IssueDetailsPanel";
import { NO_SPRINT, UNASSIGNED } from "./IssueForm";

type TProps = {
	/** The issue to edit; null closes the modal. */
	issue: Issue | null;
	onClose: () => void;
	members: Member[];
	workspaceId: string;
	projectId: string;
	permissions: Permissions;
};

/**
 * Issue detail + edit modal. Same two-section layout as the detail page: the
 * content (title + description) on the left and the "Details" metadata panel on
 * the right, each saved independently. Keyed per issue so opening a different
 * one resets the fields without a sync effect.
 */
export default function IssueDetailModal({
	issue,
	onClose,
	members,
	workspaceId,
	projectId,
	permissions,
}: TProps) {
	const { data: sprints = [] } = useSprints(workspaceId, projectId);
	const {
		handleSaveContent,
		handleSaveDetails,
		isSavingContent,
		isSavingDetails,
	} = useIssueEditor(workspaceId, projectId, issue);

	return (
		<MyModal
			isOpen={!!issue}
			onOpenChange={(open) => !open && onClose()}
			size="cover"
			title="Issue details"
		>
			{issue && (
				<div
					key={issue.id}
					className="grid grid-cols-1 gap-5 xl:grid-cols-6 "
				>
					<div className="xl:col-span-4">
						<IssueContentForm
							defaultValues={{
								title: issue.title,
								description: issue.description ?? "",
							}}
							onSubmit={handleSaveContent}
							isSubmitting={isSavingContent}
							canEdit={permissions.canEditIssueFields}
						/>
					</div>
					<div className="xl:col-span-2 border-0 xl:border-l pl-4">
						<IssueDetailsPanel
							defaultValues={{
								status: issue.status,
								priority: issue.priority,
								assigneeId: issue.assigneeId ?? UNASSIGNED,
								sprintId: issue.sprintId ?? NO_SPRINT,
							}}
							onSubmit={handleSaveDetails}
							isSubmitting={isSavingDetails}
							members={members}
							sprints={sprints}
							reporter={issue.reporter}
							permissions={permissions}
						/>
					</div>
				</div>
			)}
		</MyModal>
	);
}
