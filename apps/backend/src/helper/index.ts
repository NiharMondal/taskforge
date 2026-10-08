import crypto from "crypto";

export const generateToken = () => crypto.randomBytes(32).toString("hex");

export const futureDate = (days = 7) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000);

/** Canonical form for matching emails: they are case-insensitive in practice. */
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

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
