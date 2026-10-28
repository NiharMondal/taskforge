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
import type { IssueStatus } from "../types/issue-types";
import { parseEstimate } from "../lib/estimate";
type TProps = {
	isOpen: boolean;
	onOpenChange: () => void;
	members: Member[];
	projectId: string;
	onSubmit?: (dto: TIssueFormValues) => Promise<void>;
	isLoading?: boolean;
	/** Status the form starts on (the board has no BACKLOG lane, so it passes TODO). */
	defaultStatus?: IssueStatus;
	/** Sprint the form starts on (the board passes the active sprint). */
	defaultSprintId?: string;
};
export default function CreateIssueModal({
	isOpen,
	onOpenChange,
	members,
	projectId,
	defaultStatus,
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
			{isOpen && (
				<IssueForm
					isSubmitting={isPending}
					onSubmit={handleCreateIssue}
					members={members}
					sprints={sprints}
					labels={labels}
					onCancel={onOpenChange}
					onSuccess={onOpenChange}
					initialStatus={defaultStatus}
					initialSprintId={defaultSprintId}
				/>
			)}
		</MyModal>
	);
}
