import "dotenv/config";

/**
 * The e2e suite writes real rows. It cleans up after itself, but a crashed run
 * leaves them behind, so refuse to point it at a database whose name doesn't
 * say it is disposable (e.g. `taskforge_e2e`).
 */
const url = process.env.DATABASE_URL?.trim();
if (!url) {
  throw new Error("DATABASE_URL must point at a migrated test database.");
}

const dbName = new URL(url).pathname.replace(/^\//, "");
// A whole word, not a substring: "latest" or "contest" must not pass.
if (!/(^|[_-])(e2e|tests?)([_-]|$)/i.test(dbName)) {
  throw new Error(
    `Refusing to run e2e tests against "${dbName}". Use a database whose name ` +
      `has "e2e" or "test" as a word (e.g. taskforge_e2e, test_taskforge), ` +
      `e.g. DATABASE_URL=.../taskforge_e2e pnpm test:e2e`,
  );
}

// Services that read these with getOrThrow() at boot; the tests never use them
// for real (MailService is overridden).
const placeholders: Record<string, string> = {
  JWT_ACCESS_SECRET: "e2e-only-secret",
  SMTP_HOST: "localhost",
  SMTP_PORT: "2525",
  SMTP_USER: "e2e",
  SMTP_PASS: "e2e",
  CLOUDINARY_CLOUD_NAME: "e2e",
  CLOUDINARY_API_KEY: "e2e",
  CLOUDINARY_API_SECRET: "e2e",
};
for (const [key, value] of Object.entries(placeholders)) {
  process.env[key] ??= value;
}
