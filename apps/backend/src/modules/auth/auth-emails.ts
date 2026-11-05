import { escapeHtml } from "@/helper";
import type { SendMailParams } from "@/modules/mail/mail.service";
import { EMAIL_VERIFICATION_TTL_HOURS } from "./auth.constants";

type Email = Omit<SendMailParams, "to">;

/** The shared layout: a heading, a paragraph, one button and the link spelled out. */
function layout(params: {
  heading: string;
  body: string;
  buttonLabel: string;
  url: string;
  footer: string;
}) {
  const safeUrl = escapeHtml(params.url);
  return `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="margin-bottom: 8px;">${params.heading}</h2>
        <p>${params.body}</p>
        <p style="margin: 24px 0;">
          <a href="${safeUrl}"
             style="background:#4f46e5;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;display:inline-block;">
            ${params.buttonLabel}
          </a>
        </p>
        <p style="font-size: 13px; color: #666;">
          Or paste this link into your browser:<br />
          <a href="${safeUrl}">${safeUrl}</a>
        </p>
        <p style="font-size: 12px; color: #999; margin-top: 24px;">
          ${params.footer}
        </p>
      </div>
    `;
}

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
    html: layout({
      heading: "Confirm your email",
      body: `Hi ${escapeHtml(params.name)}, confirm your email address to finish creating your TaskForge account.`,
      buttonLabel: "Confirm email",
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
    html: layout({
      heading: "You already have an account",
      body: `Hi ${escapeHtml(params.name)}, someone tried to sign up for TaskForge with this email address, which already has an account. To use it, sign in with your password or with Google.`,
      buttonLabel: "Sign in",
      url: params.url,
      footer,
    }),
  };
}
