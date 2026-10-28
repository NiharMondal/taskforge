import { applyDecorators, SetMetadata, UseGuards } from "@nestjs/common";
import {
  PermissionsGuard,
  REQUIRED_PERMISSIONS_KEY,
} from "../guards/permissions.guard";
import { Permission } from "../permissions/permissions";

/**
 * The caller's workspace role must hold every listed permission, else 403.
 * Applies PermissionsGuard itself — no separate `@UseGuards` needed. On a
 * route that also lists guards with `@UseGuards(...)`, write this decorator
 * above it: method decorators apply bottom-up, so it then runs after them.
 */
export const RequirePermission = (...permissions: Permission[]) =>
  applyDecorators(
    SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions),
    UseGuards(PermissionsGuard),
  );
