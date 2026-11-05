import MarketingFooter from "@/features/marketing/components/MarketingFooter";
import MarketingHeader from "@/features/marketing/components/MarketingHeader";

/**
 * The public site: landing, pricing, terms and privacy. No session needed
 * (`PUBLIC_PREFIXES` and the exact `/` check in `lib/auth.config.ts`).
 */
export default function MarketingLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="flex min-h-dvh flex-col">
			<MarketingHeader />
			<main className="flex-1">{children}</main>
			<MarketingFooter />
		</div>
	);
}
