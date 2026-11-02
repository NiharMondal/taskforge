"use client";

import { useEffect, useRef, useState } from "react";

import { Input, TextField } from "@heroui/react";
import { Search } from "lucide-react";

import { ADMIN_SEARCH_DEBOUNCE_MS } from "../constants";

/**
 * A list's search box. Typing updates the box at once and calls `onSearch`
 * once the user pauses; a new `value` from outside (the URL changed, e.g.
 * "back") replaces what is typed.
 */
export default function AdminSearchField({
	value,
	onSearch,
	label,
	placeholder,
}: {
	value: string;
	onSearch: (search: string) => void;
	label: string;
	placeholder: string;
}) {
	const [text, setText] = useState(value);
	const [synced, setSynced] = useState(value);
	// Resync during render, not in an effect, when the URL changes under us.
	if (value !== synced) {
		setSynced(value);
		setText(value);
	}

	const onSearchRef = useRef(onSearch);
	useEffect(() => {
		onSearchRef.current = onSearch;
	});

	useEffect(() => {
		if (text.trim() === value.trim()) return;
		const timer = setTimeout(
			() => onSearchRef.current(text.trim()),
			ADMIN_SEARCH_DEBOUNCE_MS,
		);
		return () => clearTimeout(timer);
	}, [text, value]);

	return (
		<TextField
			aria-label={label}
			value={text}
			onChange={setText}
			className="w-full sm:w-80"
		>
			<div className="relative">
				<Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted" />
				<Input placeholder={placeholder} className="w-full pl-8" />
			</div>
		</TextField>
	);
}
