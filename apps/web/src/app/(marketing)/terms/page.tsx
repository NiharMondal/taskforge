import type { Metadata } from "next";

import LegalPage from "@/features/marketing/components/LegalPage";

export const metadata: Metadata = {
	title: "Terms of Service · TaskForge",
};

// Placeholder: replace the sections below with the real terms before launch.
export default function TermsPage() {
	return (
		<LegalPage title="Terms of Service" lastUpdated="October 30, 2026">
			<section>
				<h2>1. Agreement</h2>
				<p>
					[Who the agreement is between, and that using TaskForge means
					accepting these terms.]
				</p>
			</section>
			<section>
				<h2>2. Accounts and workspaces</h2>
				<p>
					[Account eligibility, keeping credentials safe, and that a
					workspace&apos;s owner is responsible for who they invite and the
					content stored in it.]
				</p>
			</section>
			<section>
				<h2>3. Plans, billing and cancellation</h2>
				<p>
					[The Free and paid plans, per-member billing through Stripe, trials,
					renewals, refunds, and what happens when a subscription ends.]
				</p>
			</section>
			<section>
				<h2>4. Acceptable use</h2>
				<p>[What users may not do with the service.]</p>
			</section>
			<section>
				<h2>5. Your content</h2>
				<p>
					[That customers own their content, and the licence TaskForge needs to
					host and process it.]
				</p>
			</section>
			<section>
				<h2>6. Termination</h2>
				<p>[How either side can end the agreement, and data afterwards.]</p>
			</section>
			<section>
				<h2>7. Disclaimers and liability</h2>
				<p>[Warranty disclaimer and limitation of liability.]</p>
			</section>
			<section>
				<h2>8. Changes and contact</h2>
				<p>[How changes to these terms are announced, and how to reach us.]</p>
			</section>
		</LegalPage>
	);
}
