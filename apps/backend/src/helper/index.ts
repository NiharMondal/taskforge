import crypto from "crypto";

export const generateToken = () => crypto.randomBytes(32).toString("hex");

/**
 * How a secret token is stored: its SHA-256. Enough for 256-bit random tokens
 * (no salt or slow hash needed), and a database leak doesn't hand them out.
 */
export const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

export const futureDate = (days = 7) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000);

/** Canonical form for matching emails: they are case-insensitive in practice. */
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

/**
 * An absolute link into the web app, for emails and Stripe redirects. `config`
 * is the Nest `ConfigService`; `APP_URL` defaults to the local web app.
 */
export const appUrl = (
  config: { get<T = string>(key: string): T | undefined },
  path: string,
) => {
  const base = config.get<string>("APP_URL") ?? "http://localhost:3000";
  return `${base.replace(/\/+$/, "")}${path}`;
};

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escape untrusted text before interpolating it into an HTML email body. */
export const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
