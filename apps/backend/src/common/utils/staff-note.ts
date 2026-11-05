/**
 * A `User` or `Workspace` row without `suspendedReason`: the reason platform
 * staff gave for a suspension is an internal note, returned only by the
 * /admin routes (`spec/admin-spec.md`). Every other route that returns one of
 * these rows whole passes it through here. `suspendedAt` stays, so a client
 * can tell a suspended workspace.
 */
export function withoutStaffNote<T extends { suspendedReason?: unknown }>(
  row: T,
): Omit<T, "suspendedReason"> {
  const rest = { ...row };
  delete rest.suspendedReason;
  return rest;
}
