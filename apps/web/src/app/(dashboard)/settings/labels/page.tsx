import type { Metadata } from "next";
import LabelsSettings from "@/features/settings/components/LabelsSettings";

export const metadata: Metadata = { title: "Labels" };

/**
 * `/settings/labels` — the workspace's labels. The `(dashboard)` layout gates
 * auth; the settings layout supplies the tabs.
 */
export default function LabelsSettingsPage() {
	return <LabelsSettings />;
}
