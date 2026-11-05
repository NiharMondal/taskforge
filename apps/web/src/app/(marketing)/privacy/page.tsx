import type { Metadata } from "next";

import LegalPage from "@/features/marketing/components/LegalPage";

export const metadata: Metadata = {
	title: "Privacy Policy · TaskForge",
};

// Placeholder: replace the bracketed text with the real policy before launch.
// The service providers listed are the ones the app actually uses.
export default function PrivacyPage() {
	return (
		<LegalPage title="Privacy Policy" lastUpdated="October 30, 2026">
			<section>
				<h2>1. Who we are</h2>
				<p>[The company operating TaskForge and how to contact it.]</p>
			</section>
			<section>
				<h2>2. What we collect</h2>
				<ul>
					<li>Account details: your name, email address and, if you set one, a password (stored only as a hash) and a profile picture.</li>
					<li>Workspace content: projects, issues, comments and the rest of what you and your team create.</li>
					<li>Billing details for paid workspaces, handled by Stripe. Card details never reach our servers.</li>
					<li>[Logs, cookies and any analytics.]</li>
				</ul>
			</section>
			<section>
				<h2>3. Service providers</h2>
				<ul>
					<li>Stripe, for payments.</li>
					<li>Cloudinary, for storing profile pictures.</li>
					<li>Google, if you choose to sign in with Google.</li>
					<li>[Our email provider, hosting and database providers.]</li>
				</ul>
			</section>
			<section>
				<h2>4. How we use it</h2>
				<p>[Purposes and legal bases.]</p>
			</section>
			<section>
				<h2>5. Retention and deletion</h2>
				<p>[How long data is kept, and how to delete your account or export your data.]</p>
			</section>
			<section>
				<h2>6. Your rights</h2>
				<p>[Access, correction, deletion, objection, and how to exercise them.]</p>
			</section>
			<section>
				<h2>7. Changes and contact</h2>
				<p>[How changes are announced, and who to contact about privacy.]</p>
			</section>
		</LegalPage>
	);
}
