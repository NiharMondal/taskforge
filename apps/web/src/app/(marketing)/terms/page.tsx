import type { Metadata } from "next";
import Link from "next/link";

import LegalPage from "@/features/marketing/components/LegalPage";
import {
	FREE_MEMBER_LIMIT,
	LEGAL,
	PRO_TRIAL_DAYS,
} from "@/features/marketing/legal";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
	title: "Terms of Service",
	description:
		"The terms that apply when you use TaskForge, including your account, your workspaces and paid plans.",
	path: "/terms",
});

// The billing section describes how Stripe is set up (per-member monthly
// price, trial on a workspace's first upgrade, prorated seat changes,
// cancellation at the end of the period). Keep it in step with
// `apps/backend/spec/billing-spec.md`, and bump `LEGAL.lastUpdated`.
export default function TermsPage() {
	const contact = (
		<a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>
	);

	return (
		<LegalPage
			title="Terms of Service"
			lastUpdated={LEGAL.lastUpdated}
			intro={
				<>
					These terms are an agreement between you and {LEGAL.operator}{" "}
					(&quot;we&quot;, &quot;us&quot;) about your use of TaskForge. By
					creating an account or using TaskForge, you agree to them. Our{" "}
					<Link href="/privacy">Privacy Policy</Link> explains how we handle
					your information.
				</>
			}
		>
			<section>
				<h2>1. Using TaskForge for an organization</h2>
				<p>
					If you use TaskForge on behalf of a company or other organization,
					you confirm that you have authority to accept these terms for it,
					and &quot;you&quot; includes that organization.
				</p>
			</section>

			<section>
				<h2>2. Your account</h2>
				<ul>
					<li>You must be at least {LEGAL.minimumAge} years old.</li>
					<li>
						Give accurate information, and keep your email address up to date
						so we can reach you.
					</li>
					<li>
						Keep your password safe and don&apos;t share your account. You are
						responsible for what happens under it.
					</li>
					<li>
						Tell us at {contact} if you think someone else has accessed your
						account.
					</li>
				</ul>
			</section>

			<section>
				<h2>3. Workspaces</h2>
				<p>
					Work in TaskForge happens in workspaces. The person who creates a
					workspace is its owner. The owner, and anyone the owner gives
					permission to, decides who joins, what role each member has, and
					what happens to the workspace&apos;s content. The owner is
					responsible for the people they invite and for the workspace&apos;s
					plan and payments.
				</p>
				<p>
					Ownership can be transferred to another member. An owner can&apos;t
					leave or delete their account while others still use the workspace
					without transferring it or deleting it first.
				</p>
			</section>

			<section>
				<h2>4. Plans and payment</h2>
				<p>
					Current plans and what each includes are on our{" "}
					<Link href="/pricing">pricing page</Link>.
				</p>
				<ul>
					<li>
						<strong>Free</strong> costs nothing and includes up to{" "}
						{FREE_MEMBER_LIMIT} members per workspace, with some features
						limited.
					</li>
					<li>
						<strong>Pro</strong> is billed monthly for each member of the
						workspace, at the price shown at checkout. Payments are processed
						by Stripe.
					</li>
					<li>
						<strong>Free trial:</strong> the first time a workspace upgrades,
						Pro is free for {PRO_TRIAL_DAYS} days. If you don&apos;t cancel
						before the trial ends, your subscription starts and you are
						charged.
					</li>
					<li>
						<strong>Members and charges:</strong> when members join or leave a
						Pro workspace, the number of paid seats changes with them, and the
						next invoice includes a prorated charge or credit for the rest of
						the period.
					</li>
					<li>
						<strong>Renewal:</strong> a subscription renews automatically each
						month until it is canceled.
					</li>
					<li>
						<strong>Cancellation:</strong> the owner can cancel at any time
						under <strong>Settings → Billing → Manage billing</strong>. Pro
						stays active until the end of the period already paid for, then
						the workspace returns to Free.
					</li>
					<li>
						<strong>Refunds:</strong> payments are not refundable, including
						for partly used periods, except where the law requires otherwise.
					</li>
					<li>
						<strong>Failed payments:</strong> if a payment fails and is not
						resolved, the workspace may return to Free.
					</li>
					<li>
						<strong>Price changes:</strong> we will tell the owner at least 30
						days before a new price applies to an existing subscription.
					</li>
					<li>
						Prices do not include taxes unless stated. You are responsible for
						any taxes that apply.
					</li>
					<li>
						<strong>Enterprise</strong> plans are arranged with us directly and
						may come with a separate agreement, which takes precedence over
						these terms where they differ.
					</li>
				</ul>
				<p>
					When a workspace returns to Free, nothing in it is deleted, but Pro
					features stop being available. Some things created with them (such
					as a custom workflow) can become read-only, and no new members can
					join while the workspace has more than the Free limit.
				</p>
			</section>

			<section>
				<h2>5. Your content</h2>
				<p>
					You keep ownership of everything you and your team put into
					TaskForge. You give us permission to store, copy, process and
					display that content only as needed to run TaskForge for you, to
					keep it secure, and as required by law. This permission ends when
					the content is deleted, apart from copies kept for a short time in
					backups.
				</p>
				<p>
					You are responsible for your content and for having the right to
					put it in TaskForge. If you send us feedback or suggestions, we
					may use them without any obligation to you.
				</p>
			</section>

			<section>
				<h2>6. Acceptable use</h2>
				<p>Don&apos;t use TaskForge to:</p>
				<ul>
					<li>break the law or infringe anyone&apos;s rights;</li>
					<li>
						store or share content that is unlawful, harassing, hateful or
						infringes intellectual property;
					</li>
					<li>send spam, including invitations to people who didn&apos;t ask for them;</li>
					<li>upload malware or anything else meant to cause harm;</li>
					<li>
						access accounts or data that aren&apos;t yours, or probe, scan or
						test the security of TaskForge without our written permission;
					</li>
					<li>
						overload or disrupt the service, or get around its limits,
						including plan limits;
					</li>
					<li>
						copy, resell or reverse-engineer TaskForge, except as the law
						allows.
					</li>
				</ul>
			</section>

			<section>
				<h2>7. Our service</h2>
				<p>
					TaskForge, including its software, design and name, belongs to us.
					These terms give you the right to use it, not to own any part of
					it. We improve TaskForge continually and may add, change or remove
					features. If we remove a significant feature of a paid plan, we
					will tell affected owners in advance.
				</p>
			</section>

			<section>
				<h2>8. Suspension and termination</h2>
				<p>
					You can stop using TaskForge at any time and delete your account in{" "}
					<strong>Settings → Profile</strong>. A workspace&apos;s owner can
					delete the workspace, which also cancels its subscription.
				</p>
				<p>
					We may suspend or close an account or workspace that breaks these
					terms, that puts other users or TaskForge at risk, whose payments
					are overdue, or where the law requires it. Where it is reasonable,
					we will tell you first and give you a chance to fix the problem.
				</p>
				<p>
					What happens to data after an account or workspace is deleted is
					described in our <Link href="/privacy">Privacy Policy</Link>. You
					can download your data from Settings → Profile before you leave.
				</p>
			</section>

			<section>
				<h2>9. Disclaimer</h2>
				<p>
					TaskForge is provided &quot;as is&quot; and &quot;as
					available&quot;. We work to keep it running, secure and free of
					errors, but we don&apos;t promise that it always will be. To the
					extent the law allows, we disclaim all warranties, including
					implied warranties of merchantability, fitness for a particular
					purpose and non-infringement. Keep your own copies of anything you
					can&apos;t afford to lose.
				</p>
			</section>

			<section>
				<h2>10. Limitation of liability</h2>
				<p>
					To the extent the law allows, we are not liable for indirect,
					incidental, special or consequential damages, or for lost profits,
					revenue or data. Our total liability for any claim about TaskForge
					is limited to the amount you paid us in the 12 months before the
					claim arose, or US$100 if you paid nothing. Nothing in these terms
					limits liability that cannot be limited by law.
				</p>
			</section>

			<section>
				<h2>11. Indemnity</h2>
				<p>
					If someone makes a claim against us because of your content or
					your breach of these terms, you agree to cover the reasonable
					costs that result, to the extent the law allows.
				</p>
			</section>

			<section>
				<h2>12. Governing law</h2>
				<p>
					These terms are governed by the laws of {LEGAL.governingLaw}, and
					disputes will be heard by its courts, unless the law where you
					live gives you the right to bring a claim there.
				</p>
			</section>

			<section>
				<h2>13. Changes to these terms</h2>
				<p>
					We may update these terms. When we do, we change the date at the
					top. For significant changes, we will tell you by email or in the
					app at least 30 days before they take effect. If you keep using
					TaskForge after that, you accept the new terms. If you don&apos;t
					agree, you can delete your account before they take effect.
				</p>
			</section>

			<section>
				<h2>14. General</h2>
				<p>
					These terms and the Privacy Policy are the whole agreement between
					you and us about TaskForge. If a part of them can&apos;t be
					enforced, the rest still applies. Not enforcing a part right away
					doesn&apos;t mean we give up the right to. You may not transfer
					these terms without our consent. We may transfer them if TaskForge
					is sold or merged.
				</p>
			</section>

			<section>
				<h2>15. Contact</h2>
				<p>
					{LEGAL.operator} — {contact}
				</p>
			</section>
		</LegalPage>
	);
}
