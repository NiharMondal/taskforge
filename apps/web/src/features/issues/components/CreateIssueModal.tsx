import MyModal from "@/components/ui/my-modal";
import IssueForm from "./IssueForm";
import { Member } from "@/features/memberships/types/membership-types";
import { TIssueFormValues } from "../schema/issue-schema";
import { useCreateIssue } from "../hooks/use-issues";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { toast } from "@heroui/react";
import { getApiErrorMessage } from "@/lib/api-error";
import { useSprints } from "@/features/sprint/hooks/use-sprints";
import { useLabels } from "@/features/labels/hooks/use-labels";
import { useWorkflow } from "@/features/workflow/hooks/use-workflow";
import { Spinner } from "@heroui/react";
import { parseEstimate } from "../lib/estimate";
type TProps = {
	isOpen: boolean;
	onOpenChange: () => void;
	members: Member[];
	projectId: string;
	onSubmit?: (dto: TIssueFormValues) => Promise<void>;
	isLoading?: boolean;
	/**
	 * Status the form starts on; the project's default unless given. The board
	 * passes its first lane, since it shows no backlog statuses.
	 */
	defaultStatusId?: string;
	/** Sprint the form starts on (the board passes the active sprint). */
	defaultSprintId?: string;
};
export default function CreateIssueModal({
	isOpen,
	onOpenChange,
	members,
	projectId,
	defaultStatusId,
	defaultSprintId,
}: TProps) {
	const { activeWorkspaceId } = useWorkspace();
	const workspaceId = activeWorkspaceId ?? "";
	const { mutateAsync: createIssue, isPending } = useCreateIssue(
		workspaceId,
		projectId!,
	);
	const { data: sprints = [] } = useSprints(workspaceId, projectId);
	const { data: labels = [] } = useLabels(workspaceId);
	const { view: workflow } = useWorkflow(workspaceId, projectId);

	const handleCreateIssue = async (values: TIssueFormValues) => {
		try {
			const res = await createIssue({
				...values,
				timeEstimate: parseEstimate(values.timeEstimate),
			});
			toast.success(res.message || "Issue created successfully");
			return true;
		} catch (error) {
			toast.danger(getApiErrorMessage(error));
			return false;
		}
	};

	return (
		<MyModal
			isOpen={isOpen}
			onOpenChange={onOpenChange}
			// size="lg"
			width="md:min-w-[600px] max-h-[90vh]"
			title="Create Issue"
		>
			{isOpen && !workflow && (
				<div className="flex justify-center py-8">
					<Spinner />
				</div>
			)}
			{isOpen && workflow && (
				<IssueForm
					isSubmitting={isPending}
					onSubmit={handleCreateIssue}
					members={members}
					sprints={sprints}
					labels={labels}
					onCancel={onOpenChange}
					onSuccess={onOpenChange}
					statuses={workflow.statuses}
					initialStatusId={
						defaultStatusId ?? workflow.defaultStatus?.id ?? ""
					}
					initialSprintId={defaultSprintId}
				/>
			)}
		</MyModal>
	);
}
