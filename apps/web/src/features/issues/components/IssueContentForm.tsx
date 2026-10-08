"use client";

import { useMemo, useState } from "react";

import { Button, Label } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";

import {
	FormRichTextEditor,
	FormTextField,
	FormWrapper,
} from "@/components/form-element";
import { sanitizeHtml } from "@/lib/sanitize-html";

import {
	issueContentSchema,
	TIssueContentValues,
} from "../schema/issue-schema";

type Props = {
	defaultValues: TIssueContentValues;
	onSubmit: (values: TIssueContentValues) => Promise<boolean | void>;
	isSubmitting: boolean;
	/** False renders the content read-only (no inputs, no Save). */
	canEdit: boolean;
};

/**
 * Left column of the issue detail page: the issue's content (title +
 * description). Saved on its own, independent of the details panel.
 *
 * The description reads as rendered content by default; the Edit button (or a
 * click on the text) swaps in the rich-text editor with Save / Cancel. The
 * stored HTML is sanitized before it is rendered — it is user-authored and the
 * backend stores it as-is.
 */
export default function IssueContentForm({
	defaultValues,
	onSubmit,
	isSubmitting,
	canEdit,
}: Props) {
	const methods = useForm<TIssueContentValues>({
		resolver: zodResolver(issueContentSchema),
		// Async-loaded issue is fed through `values`; keepDirtyValues avoids
		// clobbering in-progress edits if a refetch resolves mid-typing.
		values: defaultValues,
		resetOptions: { keepDirtyValues: true },
	});
	const { isDirty } = methods.formState;

	const [isEditingDescription, setIsEditingDescription] = useState(false);
	// Watched so the read view reflects the latest (incl. just-saved) content.
	const description = useWatch({
		control: methods.control,
		name: "description",
	});
	const safeDescription = useMemo(
		() => sanitizeHtml(description ?? ""),
		[description],
	);

	const handleSubmit = async (values: TIssueContentValues) => {
		const success = await onSubmit(values);
		if (success === false) return;
		// Re-baseline so the form is no longer dirty against the saved content.
		methods.reset(values);
		setIsEditingDescription(false);
	};

	const handleCancelDescription = () => {
		// Drop any in-progress edits and fall back to the rendered view.
		methods.resetField("description");
		setIsEditingDescription(false);
	};

	const isEditing = canEdit && isEditingDescription;

	return (
		<FormWrapper methods={methods} onSubmit={handleSubmit}>
			<FormTextField
				name="title"
				label="Title"
				placeholder="e.g. Login button is misaligned"
				isRequired
				isReadOnly={!canEdit}
			/>

			<div className="flex flex-col gap-1">
				<div className="flex items-center justify-between">
					<Label>Description</Label>
					{canEdit && !isEditing && (
						<Button
							type="button"
							size="sm"
							variant="ghost"
							onPress={() => setIsEditingDescription(true)}
						>
							<Pencil className="h-3.5 w-3.5" />
							Edit
						</Button>
					)}
				</div>

				{isEditing ? (
					<div className="flex flex-col gap-2">
						<FormRichTextEditor
							name="description"
							placeholder="Optional details, steps to reproduce, acceptance criteria…"
						/>
						<div className="flex gap-2">
							<Button type="submit" isDisabled={isSubmitting}>
								{isSubmitting ? "Saving…" : "Save"}
							</Button>
							<Button
								type="button"
								variant="outline"
								onClick={handleCancelDescription}
							>
								Cancel
							</Button>
						</div>
					</div>
				) : (
					<div
						// Click-to-edit is a mouse convenience only; the Edit button
						// above is the accessible path, so this is not a "button".
						onClick={
							canEdit
								? (e) => {
										// Following a link in the description must
										// not also open the editor.
										if (
											(e.target as HTMLElement).closest("a")
										) {
											return;
										}
										setIsEditingDescription(true);
									}
								: undefined
						}
						// Reuse tiptap prose styling but drop the editor's fixed
						// height so the read view hugs its content.
						style={{ height: "auto", overflow: "visible" }}
						className={`tiptap-content min-h-12 rounded-2xl border border-transparent transition-colors ${
							canEdit ? "cursor-text hover:border-border" : ""
						} ${safeDescription ? "" : "text-muted"}`}
						dangerouslySetInnerHTML={{
							__html: safeDescription || "No description added",
						}}
					/>
				)}
			</div>

			{/* Title-only save; the description carries its own Save when open. */}
			{canEdit && !isEditing && (
				<div className="flex justify-end">
					<Button type="submit" isDisabled={!isDirty || isSubmitting}>
						{isSubmitting ? "Saving…" : "Save"}
					</Button>
				</div>
			)}
		</FormWrapper>
	);
}
