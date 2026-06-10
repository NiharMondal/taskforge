"use client";

import { useEffect } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
	Bold,
	Code,
	Heading2,
	Italic,
	List,
	ListOrdered,
	Quote,
	Redo2,
	Strikethrough,
	Undo2,
} from "lucide-react";

import type { Editor } from "@tiptap/react";

type RichTextEditorProps = {
	/** Current value as an HTML string. */
	value?: string;
	/** Called with the editor's HTML on every change ("" when empty). */
	onChange?: (html: string) => void;
	onBlur?: () => void;
	placeholder?: string;
	isInvalid?: boolean;
	"aria-label"?: string;
};

/** Tiptap considers a doc with a single empty paragraph "empty" — treat it as "". */
function normalize(editor: Editor) {
	return editor.isEmpty ? "" : editor.getHTML();
}

export default function RichTextEditor({
	value = "",
	onChange,
	onBlur,
	placeholder,
	isInvalid,
	"aria-label": ariaLabel,
}: RichTextEditorProps) {
	const editor = useEditor({
		extensions: [StarterKit],
		content: value,
		// Required for Next.js SSR: render the editor after mount to avoid
		// hydration mismatches.
		immediatelyRender: false,
		editorProps: {
			attributes: {
				class: "tiptap-content",
				...(ariaLabel ? { "aria-label": ariaLabel } : {}),
			},
		},
		onUpdate: ({ editor }) => onChange?.(normalize(editor)),
		onBlur: () => onBlur?.(),
	});

	// Keep the editor in sync when the form value changes externally
	// (e.g. methods.reset()). Guard against the feedback loop from onUpdate.
	useEffect(() => {
		if (!editor) return;
		if (value !== normalize(editor)) {
			editor.commands.setContent(value, { emitUpdate: false });
		}
	}, [editor, value]);

	if (!editor) return null;

	return (
		<div
			data-invalid={isInvalid || undefined}
			className="rich-text-editor"
		>
			<Toolbar editor={editor} />
			<EditorBody editor={editor} placeholder={placeholder} />
		</div>
	);
}

/**
 * StarterKit ships no Placeholder extension, so render our own overlay that
 * shows while the document is empty. `pointer-events-none` lets clicks fall
 * through to focus the editor.
 */
function EditorBody({
	editor,
	placeholder,
}: {
	editor: Editor;
	placeholder?: string;
}) {
	const isEmpty = useEditorState({
		editor,
		selector: ({ editor }) => editor.isEmpty,
	});

	return (
		<div className="rich-text-editor__body">
			{placeholder && isEmpty && (
				<span className="rich-text-editor__placeholder">
					{placeholder}
				</span>
			)}
			<EditorContent editor={editor} />
		</div>
	);
}

type ToolbarButtonProps = {
	onPress: () => void;
	isActive?: boolean;
	isDisabled?: boolean;
	label: string;
	children: React.ReactNode;
};

function ToolbarButton({
	onPress,
	isActive,
	isDisabled,
	label,
	children,
}: ToolbarButtonProps) {
	return (
		<button
			type="button"
			onClick={onPress}
			disabled={isDisabled}
			aria-label={label}
			aria-pressed={isActive}
			data-active={isActive || undefined}
			className="rich-text-editor__btn"
		>
			{children}
		</button>
	);
}

function Toolbar({ editor }: { editor: Editor }) {
	// Subscribe to just the bits of editor state the toolbar paints, so it
	// re-renders on selection / content changes without re-rendering on every keystroke.
	const state = useEditorState({
		editor,
		selector: ({ editor }) => ({
			isBold: editor.isActive("bold"),
			isItalic: editor.isActive("italic"),
			isStrike: editor.isActive("strike"),
			isCode: editor.isActive("code"),
			isHeading: editor.isActive("heading", { level: 2 }),
			isBulletList: editor.isActive("bulletList"),
			isOrderedList: editor.isActive("orderedList"),
			isBlockquote: editor.isActive("blockquote"),
			canUndo: editor.can().undo(),
			canRedo: editor.can().redo(),
		}),
	});

	return (
		<div className="rich-text-editor__toolbar">
			<ToolbarButton
				label="Bold"
				isActive={state.isBold}
				onPress={() => editor.chain().focus().toggleBold().run()}
			>
				<Bold size={16} />
			</ToolbarButton>
			<ToolbarButton
				label="Italic"
				isActive={state.isItalic}
				onPress={() => editor.chain().focus().toggleItalic().run()}
			>
				<Italic size={16} />
			</ToolbarButton>
			<ToolbarButton
				label="Strikethrough"
				isActive={state.isStrike}
				onPress={() => editor.chain().focus().toggleStrike().run()}
			>
				<Strikethrough size={16} />
			</ToolbarButton>
			<ToolbarButton
				label="Inline code"
				isActive={state.isCode}
				onPress={() => editor.chain().focus().toggleCode().run()}
			>
				<Code size={16} />
			</ToolbarButton>

			<span className="rich-text-editor__divider" />

			<ToolbarButton
				label="Heading"
				isActive={state.isHeading}
				onPress={() =>
					editor.chain().focus().toggleHeading({ level: 2 }).run()
				}
			>
				<Heading2 size={16} />
			</ToolbarButton>
			<ToolbarButton
				label="Bullet list"
				isActive={state.isBulletList}
				onPress={() => editor.chain().focus().toggleBulletList().run()}
			>
				<List size={16} />
			</ToolbarButton>
			<ToolbarButton
				label="Numbered list"
				isActive={state.isOrderedList}
				onPress={() => editor.chain().focus().toggleOrderedList().run()}
			>
				<ListOrdered size={16} />
			</ToolbarButton>
			<ToolbarButton
				label="Quote"
				isActive={state.isBlockquote}
				onPress={() => editor.chain().focus().toggleBlockquote().run()}
			>
				<Quote size={16} />
			</ToolbarButton>

			<span className="rich-text-editor__divider" />

			<ToolbarButton
				label="Undo"
				isDisabled={!state.canUndo}
				onPress={() => editor.chain().focus().undo().run()}
			>
				<Undo2 size={16} />
			</ToolbarButton>
			<ToolbarButton
				label="Redo"
				isDisabled={!state.canRedo}
				onPress={() => editor.chain().focus().redo().run()}
			>
				<Redo2 size={16} />
			</ToolbarButton>
		</div>
	);
}
