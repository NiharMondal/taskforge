"use client";

import { Button } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { FormRichTextEditor, FormWrapper } from "@/components/form-element";

import { commentSchema, type TCommentValues } from "../schema/comment-schema";

type Props = {
	/** The comment being edited; omit to write a new one. */
	defaultContent?: string;
	/** Resolves `false` on failure so the editor keeps what was typed. */
	onSubmit: (values: TCommentValues) => Promise<boolean>;
	isSubmitting: boolean;
	/** Shown next to Save when editing. */
	onCancel?: () => void;
};

/**
 * The rich-text editor for one comment: a new comment at the bottom of the
 * thread, or an existing one being edited in place.
 */
export default function CommentForm({
	defaultContent,
	onSubmit,
	isSubmitting,
	onCancel,
}: Props) {
	const isEditing = defaultContent !== undefined;
	const methods = useForm<TCommentValues>({
		resolver: zodResolver(commentSchema),
		defaultValues: { content: defaultContent ?? "" },
	});

	const handleSubmit = async (values: TCommentValues) => {
		const success = await onSubmit(values);
		// Clear the box for the next comment; an edit's parent closes it.
		if (success && !isEditing) methods.reset({ content: "" });
	};

	return (
		<FormWrapper methods={methods} onSubmit={handleSubmit}>
			<FormRichTextEditor
				name="content"
				placeholder={isEditing ? "Edit your comment…" : "Add a comment…"}
				
			/>
			<div className="flex justify-end gap-2">
				{onCancel && (
					<Button type="button" variant="outline" onClick={onCancel}>
						Cancel
					</Button>
				)}
				<Button type="submit" isDisabled={isSubmitting}>
					{isSubmitting
						? "Saving…"
						: isEditing
							? "Save"
							: "Comment"}
				</Button>
			</div>
		</FormWrapper>
	);
}
