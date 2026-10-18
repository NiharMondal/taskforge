"use client";

import { Alert, Button } from "@heroui/react";

type Props = {
	title: string;
	description?: string;
	/** Renders a "Try again" button, typically a query's `refetch`. */
	onRetry?: () => void;
};

/**
 * Inline danger alert for a failed query, so a hook's `isError` renders
 * something instead of an empty page.
 */
export default function ErrorAlert({ title, description, onRetry }: Props) {
	return (
		<Alert status="danger">
			<Alert.Indicator />
			<Alert.Content>
				<Alert.Title>{title}</Alert.Title>
				{description && (
					<Alert.Description>{description}</Alert.Description>
				)}
				{onRetry && (
					<Button
						type="button"
						size="sm"
						variant="outline"
						className="mt-2 w-fit"
						onPress={onRetry}
					>
						Try again
					</Button>
				)}
			</Alert.Content>
		</Alert>
	);
}
