import { escapeHtml } from "@/helper";
import { emailLayout, type Email } from "@/modules/mail/email-layout";

/**
 * Sent after `DELETE /users/me`, to the address the account had, so the owner
 * hears about a deletion they didn't make.
 */
export function accountDeletedEmail(params: {
  name: string;
  url: string;
}): Email {
  const footer =
    "If you didn't delete your account, someone else had access to it. Reply to this email or contact support.";
  return {
    subject: "Your TaskForge account was deleted",
    text:
      `Hi ${params.name},\n\n` +
      `Your TaskForge account was deleted, along with the workspaces only you belonged to. ` +
      `Issues and comments you wrote in shared workspaces stay there, shown as by "Deleted user". ` +
      `You're welcome back any time: ${params.url}\n\n` +
      footer,
    html: emailLayout({
      heading: "Your account was deleted",
      body: `Hi ${escapeHtml(params.name)}, your TaskForge account was deleted, along with the workspaces only you belonged to. Issues and comments you wrote in shared workspaces stay there, shown as by "Deleted user".`,
      buttonLabel: "Visit TaskForge",
      url: params.url,
      footer,
    }),
  };
}
