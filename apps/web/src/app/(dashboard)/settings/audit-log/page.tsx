import type { Metadata } from "next";
import AuditLogSettings from "@/features/audit/components/AuditLogSettings";

export const metadata: Metadata = { title: "Audit log" };

/**
 * `/settings/audit-log` — who changed the workspace's members, roles,
 * details and billing. The `(dashboard)` layout gates auth; the settings
 * layout supplies the tabs (this one only with `audit:read`).
 */
export default function AuditLogSettingsPage() {
	return <AuditLogSettings />;
}
