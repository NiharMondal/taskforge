import { escapeHtml } from "@/helper";
import { emailLayout, type Email } from "@/modules/mail/email-layout";

/** Sent to the invited address: the link that accepts the invitation. */
export function invitationEmail(params: {
  inviterName: string;
  workspaceName: string;
  url: string;
}): Email {
  const footer =
    "This invitation expires in 7 days. If you weren't expecting this, you can safely ignore this email.";
  return {
    subject: `${params.inviterName} invited you to join "${params.workspaceName}" on TaskForge`,
    text:
      `${params.inviterName} has invited you to join the "${params.workspaceName}" workspace on TaskForge.\n\n` +
      `Accept your invitation: ${params.url}\n\n` +
      footer,
    // Inviter and workspace names are user-controlled, so they are escaped for
    // the HTML part (the subject and text part are plain text).
    html: emailLayout({
      heading: "You've been invited to TaskForge",
      body: `<strong>${escapeHtml(params.inviterName)}</strong> has invited you to join the <strong>${escapeHtml(params.workspaceName)}</strong> workspace.`,
      buttonLabel: "Accept invitation",
      url: params.url,
      footer,
    }),
  };
}
