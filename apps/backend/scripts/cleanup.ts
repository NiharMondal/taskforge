/**
 * Runs the daily cleanup once (`CleanupService`, `src/modules/maintenance/`):
 * expired sign-up and reset links, old refresh tokens and Stripe event ids,
 * and PENDING invitations past their expiry.
 *
 *   pnpm run cleanup
 *
 * Safe to run any time: every task is idempotent, and it does nothing while a
 * running backend holds the cleanup lock.
 */
import "dotenv/config";

import { CleanupService } from "@/modules/maintenance/cleanup.service";
import { PrismaService } from "@/prisma/prisma.service";

const prisma = new PrismaService();

async function main() {
  const report = await new CleanupService(prisma).run();
  console.log(report ?? "Skipped: another process is running the cleanup.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
