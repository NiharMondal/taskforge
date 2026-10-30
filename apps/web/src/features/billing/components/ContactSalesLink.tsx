import { Mail } from "lucide-react";

import { SALES_EMAIL } from "../constants";

/** "Contact us" on the Enterprise card; nothing when `SALES_EMAIL` is unset. */
export default function ContactSalesLink() {
	if (!SALES_EMAIL) return null;
	return (
		<a
			href={`mailto:${SALES_EMAIL}?subject=${encodeURIComponent("TaskForge Enterprise")}`}
			className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline"
		>
			<Mail className="size-4" />
			Contact us
		</a>
	);
}
