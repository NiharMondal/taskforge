"use client";

import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	toast,
} from "@heroui/react";
import { Download } from "lucide-react";

import { useExportMyData } from "@/features/profile/hooks/use-profile";
import { downloadJson } from "@/features/profile/lib/download-json";
import { getApiErrorMessage } from "@/lib/api-error";

/**
 * Settings → Profile: saves everything the account holds about the user
 * (`GET /users/me/export`) as a JSON file. The backend allows a few downloads
 * an hour; past that it answers 429, shown as the toast.
 */
export default function DownloadDataCard() {
	const { mutateAsync: exportMyData, isPending } = useExportMyData();

	const handleDownload = async () => {
		try {
			const data = await exportMyData();
			const date = new Date().toISOString().slice(0, 10);
			downloadJson(data, `taskforge-data-${date}.json`);
		} catch (error) {
			toast.danger(getApiErrorMessage(error, "Couldn't download your data"));
		}
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle>Your data</CardTitle>
				<CardDescription>
					Download your profile, your workspace memberships, and the issues
					and comments you wrote or are assigned to, as a JSON file.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Button
					variant="outline"
					className="self-start"
					onPress={handleDownload}
					isDisabled={isPending}
				>
					<Download className="size-4" />
					{isPending ? "Preparing…" : "Download my data"}
				</Button>
			</CardContent>
		</Card>
	);
}
