/**
 * Grant, change or remove a user's platform (super) admin role
 * (`spec/admin-spec.md`). The only way anyone becomes platform staff: no API
 * route writes `User.platformRole`.
 *
 *   pnpm run set-platform-role <email> <ADMIN|SUPPORT|none>
 *
 * ADMIN may act on any workspace or account; SUPPORT only reads. `none`
 * removes the role. Each change is recorded in `PlatformAuditLog` with no
 * actor. Takes effect on the user's next request: the role is read from the
 * database every time, never from their token.
 */
import "dotenv/config";

import {
  parsePlatformRoleArg,
  PLATFORM_ROLE_ARGS,
  setPlatformRole,
} from "@/modules/admin/set-platform-role";
import { PrismaService } from "@/prisma/prisma.service";

const prisma = new PrismaService();

async function main() {
  const [email, roleArg] = process.argv.slice(2);
  if (!email || !roleArg) {
    console.error(
      `Usage: pnpm run set-platform-role <email> <${PLATFORM_ROLE_ARGS.join("|")}>`,
    );
    process.exitCode = 1;
    return;
  }

  const role = parsePlatformRoleArg(roleArg);
  const { user, from, to, changed } = await setPlatformRole(
    prisma,
    email,
    role,
  );

  const label = (r: string | null) => r ?? "none";
  console.log(
    changed
      ? `${user.name} <${user.email}>: ${label(from)} → ${label(to)}`
      : `${user.name} <${user.email}> already has ${label(to)}; nothing changed.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
