import { escapeHtml } from "@/helper";
import type { SendMailParams } from "./mail.service";

/** What an email builder returns: everything `sendMail` needs but the recipient. */
export type Email = Omit<SendMailParams, "to">;

/**
 * The shared layout: a heading, a paragraph, one button and the link spelled
 * out. Only `url` is escaped here; `heading`, `body`, `buttonLabel` and
 * `footer` land in the HTML as given, so callers escape any user-controlled
 * text in them with `escapeHtml`.
 */
export function emailLayout(params: {
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
