import { normalizeEmail } from "@/helper";
import type { PrismaClient } from "generated/prisma/client";
import { PlatformRole } from "generated/prisma/enums";
import { recordPlatformEvent } from "./platform-audit";

/**
 * Granting and removing platform roles, for `scripts/set-platform-role.ts`.
 * This is the only way anyone becomes platform staff: no route writes
 * `User.platformRole` (`spec/admin-spec.md`).
 */

/** What the script's last argument may be: a role, or `none` to remove it. */
export const PLATFORM_ROLE_ARGS = [...Object.values(PlatformRole), "none"];

/** The role an argument names (`null` for `none`); throws on anything else. */
export function parsePlatformRoleArg(
  value: string | undefined,
): PlatformRole | null {
  const arg = value?.trim().toUpperCase();
  if (arg === "NONE") return null;
  const role = Object.values(PlatformRole).find((r) => r === arg);
  if (!role) {
    throw new Error(
      `Expected one of ${PLATFORM_ROLE_ARGS.join(", ")}, got "${value ?? ""}"`,
    );
  }
  return role;
}

export interface PlatformRoleChange {
  user: { id: string; email: string; name: string };
  from: PlatformRole | null;
  to: PlatformRole | null;
  /** False when the user already had `to`: nothing was written. */
  changed: boolean;
}

/**
 * Set (or with `null`, remove) the platform role of the user with `email`,
 * and record it in the platform audit log in the same transaction, with no
 * actor. Throws when no account has that email.
 */
export async function setPlatformRole(
  prisma: Pick<PrismaClient, "$transaction">,
  email: string,
  role: PlatformRole | null,
): Promise<PlatformRoleChange> {
  const normalized = normalizeEmail(email);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findFirst({
      where: { email: { equals: normalized, mode: "insensitive" } },
      select: { id: true, email: true, name: true, platformRole: true },
    });
    if (!user) {
      throw new Error(`No account has the email ${normalized}`);
    }

    const { platformRole: from, ...identity } = user;
    if (from === role) {
      return { user: identity, from, to: role, changed: false };
    }

    await tx.user.update({
      where: { id: user.id },
      data: { platformRole: role },
    });
    await recordPlatformEvent(tx, {
      actorId: null,
      action: "platform_role.changed",
      targetId: user.id,
      metadata: { email: user.email, from, to: role },
    });

    return { user: identity, from, to: role, changed: true };
  });
}
