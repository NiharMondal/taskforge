import { applyDecorators, SetMetadata, UseGuards } from "@nestjs/common";
import type { PlatformRole } from "generated/prisma/enums";
import {
  PlatformRoleGuard,
  REQUIRED_PLATFORM_ROLE_KEY,
} from "../guards/platform-role.guard";

/**
 * The caller must be platform staff with at least `role` (ADMIN also passes a
 * SUPPORT route), read from the database on every request; else 403. Applies
 * PlatformRoleGuard itself. A method-level use overrides the class's.
 */
export const RequirePlatformRole = (role: PlatformRole) =>
  applyDecorators(
    SetMetadata(REQUIRED_PLATFORM_ROLE_KEY, role),
    UseGuards(PlatformRoleGuard),
  );
