import MyModal from "@/components/ui/my-modal";
import IssueForm from "./IssueForm";
import { Member } from "@/features/memberships/types/membership-types";
import { TIssueFormValues } from "../schema/issue-schema";
import { useCreateIssue } from "../hooks/use-issues";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { toast } from "@heroui/react";
import { getApiErrorMessage } from "@/lib/api-error";
type TProps = {
	isOpen: boolean;
	onOpenChange: () => void;
	members: Member[];
	projectId: string;
	onSubmit?: (dto: TIssueFormValues) => Promise<void>;
	isLoading?: boolean;
};
export default function CreateIssueModal({
	isOpen,
	onOpenChange,
	members,
	projectId,
}: TProps) {
	const { activeWorkspaceId } = useWorkspace();
	const workspaceId = activeWorkspaceId ?? "";
	const { mutateAsync: createIssue, isPending } = useCreateIssue(
		workspaceId,
		projectId!,
	);

	const handleCreateIssue = async (values: TIssueFormValues) => {
		try {
			const res = await createIssue(values);
			toast.success(res.message || "Issue created successfully");
			return true;
		} catch (error) {
			toast.danger(getApiErrorMessage(error));
			return false;
		}
	};
	return (
		<MyModal isOpen={isOpen} onOpenChange={onOpenChange} size="cover">
			{isOpen && (
				<IssueForm
					isSubmitting={isPending}
					onSubmit={handleCreateIssue}
					members={members}
					onCancel={onOpenChange}
					onSuccess={onOpenChange}
				/>
			)}
		</MyModal>
	);
}
