"use client";

import { Eye, EyeOff } from "lucide-react";

/**
 * Show/hide control for a password field's `ornament`. A real button (not a
 * clickable div), so it is reachable by keyboard and announced with its state.
 */
export default function PasswordVisibilityToggle({
	isVisible,
	onToggle,
}: {
	isVisible: boolean;
	onToggle: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onToggle}
			aria-label={isVisible ? "Hide password" : "Show password"}
			aria-pressed={isVisible}
			className="flex rounded-sm focus-visible:outline-2 focus-visible:outline-accent"
		>
			{isVisible ? <Eye size={20} /> : <EyeOff size={20} />}
		</button>
	);
}
