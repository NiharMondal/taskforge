import { escapeHtml } from "@/helper";
import { emailLayout, type Email } from "@/modules/mail/email-layout";
import { EMAIL_VERIFICATION_TTL_HOURS } from "./auth.constants";

/** Sent on registration: the link that creates the account. */
export function verificationEmail(params: {
  name: string;
  url: string;
}): Email {
  const footer = `This link expires in ${EMAIL_VERIFICATION_TTL_HOURS} hours. If you didn't sign up for TaskForge, ignore this email and no account will be created.`;
  return {
    subject: "Confirm your email to finish signing up for TaskForge",
    text:
      `Hi ${params.name},\n\n` +
      `Confirm your email address to finish creating your TaskForge account: ${params.url}\n\n` +
      footer,
    // The name was typed by whoever registered, so it is escaped for HTML.
    html: emailLayout({
      heading: "Confirm your email",
      body: `Hi ${escapeHtml(params.name)}, confirm your email address to finish creating your TaskForge account.`,
      buttonLabel: "Confirm email",
      url: params.url,
      footer,
    }),
  };
}

/**
 * Sent after a signed-in password change, so the owner hears about a change
 * they didn't make. Every session was signed out by the change.
 */
export function passwordChangedEmail(params: {
  name: string;
  url: string;
}): Email {
  const footer =
    "If you didn't change your password, someone else may know it. Reply to this email right away so we can help you secure your account.";
  return {
    subject: "Your TaskForge password was changed",
    text:
      `Hi ${params.name},\n\n` +
      `The password for your TaskForge account was just changed, and every device was signed out. ` +
      `Sign in again with your new password: ${params.url}\n\n` +
      footer,
    html: emailLayout({
      heading: "Your password was changed",
      body: `Hi ${escapeHtml(params.name)}, the password for your TaskForge account was just changed, and every device was signed out. Sign in again with your new password.`,
      buttonLabel: "Sign in",
      url: params.url,
      footer,
    }),
  };
}

/**
 * Sent instead when someone registers an address that already has an
 * account, so the response can't tell a caller which addresses are taken.
 */
export function alreadyRegisteredEmail(params: {
  name: string;
  url: string;
}): Email {
  const footer =
    "If this wasn't you, you can ignore this email: nothing about your account has changed.";
  return {
    subject: "You already have a TaskForge account",
    text:
      `Hi ${params.name},\n\n` +
      `Someone tried to sign up for TaskForge with this email address, which already has an account. ` +
      `To use it, sign in (with your password or with Google): ${params.url}\n\n` +
      footer,
    html: emailLayout({
      heading: "You already have an account",
      body: `Hi ${escapeHtml(params.name)}, someone tried to sign up for TaskForge with this email address, which already has an account. To use it, sign in with your password or with Google.`,
      buttonLabel: "Sign in",
      url: params.url,
      footer,
    }),
  };
}
