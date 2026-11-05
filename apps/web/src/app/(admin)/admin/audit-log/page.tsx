import { PLATFORM_AUDIT_TARGET_TYPES } from "@taskforge/shared";

import AdminAuditLog from "@/features/admin/components/AdminAuditLog";

type RawSearchParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) =>
	Array.isArray(value) ? value[0] : value;

/**
 * `/admin/audit-log?targetType=&targetId=&page=` — the platform audit log
 * (ADMIN only). Malformed params fall back to the defaults rather than
 * reaching the API.
 */
export default async function AdminAuditLogPage({
	searchParams,
}: {
	searchParams: Promise<RawSearchParams>;
}) {
	const raw = await searchParams;
	const targetType = PLATFORM_AUDIT_TARGET_TYPES.find(
		(type) => type === first(raw.targetType),
	);
	const targetId = first(raw.targetId)?.trim().slice(0, 100) || undefined;
	const page = Number(first(raw.page));

	return (
		<AdminAuditLog
			params={{
				targetType,
				targetId,
				page: Number.isInteger(page) && page > 0 ? page : 1,
			}}
		/>
	);
}
