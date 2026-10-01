"use client";

import { useState } from "react";

import { Button, Label } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";

import {
	FormRichTextEditor,
	FormTextField,
	FormWrapper,
} from "@/components/form-element";

import {
	issueContentSchema,
	TIssueContentValues,
} from "../schema/issue-schema";

type Props = {
	defaultValues: TIssueContentValues;
	onSubmit: (values: TIssueContentValues) => Promise<boolean | void>;
	isSubmitting: boolean;
};

/**
 * Left column of the issue detail page: the issue's content (title +
 * description). Saved on its own, independent of the details panel.
 *
 * The description reads as rendered content by default; clicking it swaps in the
 * rich-text editor (with Save / Cancel), matching the inline-edit pattern.
 */
export default function IssueContentForm({
	defaultValues,
	onSubmit,
	isSubmitting,
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

	return (
		<FormWrapper methods={methods} onSubmit={handleSubmit}>
			<FormTextField
				name="title"
				label="Title"
				placeholder="e.g. Login button is misaligned"
				isRequired
			/>

			<div className="flex flex-col gap-1">
				<Label>Description</Label>

				{isEditingDescription ? (
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
						role="button"
						tabIndex={0}
						onClick={() => setIsEditingDescription(true)}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === " ") {
								e.preventDefault();
								setIsEditingDescription(true);
							}
						}}
						// Reuse tiptap prose styling but drop the editor's fixed
						// height so the read view hugs its content.
						style={{ height: "auto", overflow: "visible" }}
						className={`tiptap-content min-h-12 cursor-text rounded-2xl border border-transparent transition-colors hover:border-border ${
							description ? "" : "text-muted"
						}`}
						dangerouslySetInnerHTML={{
							__html: description || "No description added",
						}}
					/>
				)}
			</div>

			{/* Title-only save; the description carries its own Save when open. */}
			{!isEditingDescription && (
				<div className="flex justify-end">
					<Button type="submit" isDisabled={!isDirty || isSubmitting}>
						{isSubmitting ? "Saving…" : "Save"}
					</Button>
				</div>
			)}
		</FormWrapper>
	);
}
