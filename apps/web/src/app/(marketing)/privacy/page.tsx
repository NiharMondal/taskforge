import type { Metadata } from "next";
import Link from "next/link";

import LegalPage from "@/features/marketing/components/LegalPage";
import { LEGAL } from "@/features/marketing/legal";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
	title: "Privacy Policy",
	description:
		"How TaskForge collects, uses and protects your data, and the services that process it on our behalf.",
	path: "/privacy",
});

// Written from what the app actually stores and the providers it actually
// uses. When either changes (a new provider, a new cookie, a retention
// period), update this page and `LEGAL.lastUpdated`.
export default function PrivacyPage() {
	const contact = (
		<a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>
	);

	return (
		<LegalPage
			title="Privacy Policy"
			lastUpdated={LEGAL.lastUpdated}
			intro={
				<>
					This policy explains what information TaskForge collects when you
					use it, why, who it is shared with, and the choices you have. It
					applies to the TaskForge website and app. Using TaskForge is also
					subject to our <Link href="/terms">Terms of Service</Link>.
				</>
			}
		>
			<section>
				<h2>1. Who we are</h2>
				<p>
					TaskForge is operated by {LEGAL.operator} (&quot;we&quot;,
					&quot;us&quot;). For your account information we are the data
					controller. For the content a workspace holds (its projects,
					issues and comments) we act on behalf of the workspace, whose owner
					decides who can see and change it.
				</p>
				<p>Questions or requests about your data: {contact}.</p>
			</section>

			<section>
				<h2>2. Information we collect</h2>
				<h3>You give us</h3>
				<ul>
					<li>
						<strong>Account details:</strong> your name and email address.
					</li>
					<li>
						<strong>Sign-in details:</strong> if you set a password, we store
						only a one-way hash of it, never the password itself. If you sign
						in with Google, we receive your Google account ID, name, email
						address and profile picture from Google.
					</li>
					<li>
						<strong>Profile picture:</strong> if you upload one.
					</li>
					<li>
						<strong>Workspace content:</strong> workspaces, projects,
						sprints, issues, comments, labels, roles, and the email addresses
						of people you invite.
					</li>
				</ul>
				<h3>Created as you use TaskForge</h3>
				<ul>
					<li>
						<strong>History:</strong> a record of changes to issues and of
						workspace events (members joining or leaving, role changes,
						invitations, billing changes), with who made them and when.
					</li>
					<li>
						<strong>Session data:</strong> sign-in tokens that keep you
						signed in, and the dates your account and content were created
						and updated.
					</li>
					<li>
						<strong>Technical data:</strong> your IP address and browser
						details reach our servers with every request. We use the IP
						address to limit repeated sign-in attempts. Our hosting providers
						keep short-lived request logs.
					</li>
				</ul>
				<h3>Billing</h3>
				<p>
					When a workspace upgrades, payment is handled by Stripe. Your card
					details go directly to Stripe and never reach our servers. We keep
					the workspace&apos;s Stripe customer and subscription IDs, its plan,
					number of seats, subscription status and renewal date.
				</p>
			</section>

			<section>
				<h2>3. Cookies and local storage</h2>
				<p>
					We use only what is needed for TaskForge to work. There are no
					advertising or analytics cookies, and nothing that tracks you
					across other websites.
				</p>
				<ul>
					<li>
						<strong>Session cookie:</strong> an encrypted cookie that keeps
						you signed in, plus short-lived cookies the sign-in process uses
						for security. These are essential and expire when you sign out
						or after 30 days.
					</li>
					<li>
						<strong>Local storage in your browser:</strong> the workspace you
						last had open, your light or dark theme, and where to send you
						after you confirm your email. This stays on your device.
					</li>
				</ul>
			</section>

			<section>
				<h2>4. How we use your information</h2>
				<ul>
					<li>
						To provide TaskForge: create your account, sign you in, show you
						and your teammates your workspaces, and save your work.
					</li>
					<li>
						To send emails the service needs: confirming your email address,
						password resets, invitations, and notices about your account
						such as a changed password or a deleted account. We don&apos;t
						send marketing email.
					</li>
					<li>To take payments and manage subscriptions for paid workspaces.</li>
					<li>
						To keep TaskForge secure: preventing abuse and unauthorized
						access, and investigating problems.
					</li>
					<li>To answer your questions and support requests.</li>
					<li>To meet legal obligations, such as tax and accounting rules.</li>
				</ul>
				<p>
					We do not sell your information, use it for advertising, or share
					it with advertisers.
				</p>
				<p>
					If you are in the European Economic Area or the UK, our legal
					bases are: performing our contract with you (running the service
					you signed up for), our legitimate interests (keeping the service
					secure and improving it, which we balance against your rights), and
					legal obligations (such as keeping billing records).
				</p>
			</section>

			<section>
				<h2>5. Who can see your information</h2>
				<ul>
					<li>
						<strong>Your teammates:</strong> members of a workspace you
						belong to see your name, profile picture and what you do in that
						workspace. What each member can see and change depends on their
						role, which the workspace&apos;s owner and admins manage.
					</li>
					<li>
						<strong>Our staff:</strong> a small number of people who run
						TaskForge can view accounts and workspaces, only to provide
						support, prevent abuse or meet legal obligations.
					</li>
					<li>
						<strong>Service providers</strong> that run parts of TaskForge
						for us (listed below). They may use your information only to
						provide their service to us.
					</li>
					<li>
						<strong>When required by law,</strong> or to protect the rights,
						safety or property of our users, the public or us.
					</li>
					<li>
						<strong>A successor,</strong> if TaskForge is sold or merged. We
						would tell you before your information became subject to a
						different privacy policy.
					</li>
				</ul>
			</section>

			<section>
				<h2>6. Service providers</h2>
				<ul>
					<li>
						<strong>Vercel</strong> hosts the website and app.
					</li>
					<li>
						<strong>Render</strong> hosts our servers.
					</li>
					<li>
						<strong>Neon</strong> hosts our database.
					</li>
					<li>
						<strong>Brevo</strong> sends our emails.
					</li>
					<li>
						<strong>Cloudinary</strong> stores profile pictures.
					</li>
					<li>
						<strong>Stripe</strong> processes payments.
					</li>
					<li>
						<strong>Google</strong> signs you in, if you choose to sign in
						with Google.
					</li>
				</ul>
				<p>
					These providers may process information in countries other than
					yours, including the United States. Where the law requires it,
					these transfers are protected by safeguards such as the European
					Commission&apos;s Standard Contractual Clauses.
				</p>
			</section>

			<section>
				<h2>7. How long we keep it</h2>
				<ul>
					<li>
						Your account and workspace content are kept until you delete
						them, or until the workspace is deleted.
					</li>
					<li>
						Sign-ups that are never confirmed are deleted after 24 hours,
						password reset links after 60 minutes, and unaccepted
						invitations expire after 7 days.
					</li>
					<li>
						Sign-in tokens are deleted 30 days after they expire or are
						revoked.
					</li>
					<li>
						Billing records are kept by Stripe for as long as tax and
						accounting laws require.
					</li>
					<li>
						Deleted data can remain in our database provider&apos;s backups
						for a short period before it is overwritten.
					</li>
				</ul>
				<h3>When you delete your account</h3>
				<p>
					Your profile, sign-in details and profile picture are deleted, and
					so are workspaces where you are the only member. Issues and
					comments you wrote in workspaces shared with others stay there, so
					your teammates don&apos;t lose their work, but they are shown as
					written by &quot;Deleted user&quot;. Entries in a workspace&apos;s
					history may keep your name as it was when the change was made. If
					you own a workspace that other people use, you need to transfer
					it to someone else or delete it first.
				</p>
			</section>

			<section>
				<h2>8. Your rights and choices</h2>
				<p>
					Depending on where you live, you may have the right to access,
					correct, delete or export your information, and to object to or
					restrict how we use it. You can do most of this yourself, in{" "}
					<strong>Settings → Profile</strong>:
				</p>
				<ul>
					<li>Edit your name and profile picture.</li>
					<li>
						Download a copy of your data with <strong>Download my data</strong>.
					</li>
					<li>Delete your account.</li>
				</ul>
				<p>
					For anything else, email {contact}. We will answer within 30 days.
					If you are in the EEA or the UK, you can also complain to your
					local data protection authority.
				</p>
				<p>
					Content in a workspace is controlled by that workspace. To have
					something you posted there removed, ask the workspace&apos;s owner
					or an admin first.
				</p>
			</section>

			<section>
				<h2>9. Security</h2>
				<p>
					All traffic to TaskForge is encrypted with HTTPS. Passwords are
					stored as one-way hashes, session cookies are encrypted, sign-in
					tokens are short-lived, and every workspace&apos;s data is kept
					apart from every other&apos;s. No system is perfectly secure,
					though. If we learn of a breach that affects your information, we
					will tell you as the law requires.
				</p>
			</section>

			<section>
				<h2>10. Children</h2>
				<p>
					TaskForge is not meant for anyone under {LEGAL.minimumAge}, and we
					don&apos;t knowingly collect their information. If you believe a
					child has given us information, contact us and we will delete it.
				</p>
			</section>

			<section>
				<h2>11. Changes to this policy</h2>
				<p>
					When we change this policy, we update the date at the top. If a
					change is significant, we will also tell you by email or in the
					app before it takes effect.
				</p>
			</section>

			<section>
				<h2>12. Contact</h2>
				<p>
					{LEGAL.operator} — {contact}
				</p>
			</section>
		</LegalPage>
	);
}
