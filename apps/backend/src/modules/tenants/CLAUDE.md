# Tenant isolation rules

## The golden rule
Every database query MUST be scoped to a tenantId. There are no exceptions.
If you find yourself writing a Prisma query without a tenantId filter, stop and reconsider.

## How to get tenantId in a service
Inject it via the TenantInterceptor which sets AsyncLocalStorage context,
OR accept it as a parameter from the controller (which reads from req.user.tenantId).
Never accept tenantId from a DTO or query string — this is a security boundary.

## Prisma query pattern
// CORRECT
prisma.resource.findMany({ where: { tenantId: user.tenantId, ...filters } })

// WRONG — missing tenantId scope
prisma.resource.findMany({ where: { id: resourceId } })

## Cross-tenant admin operations
Only allowed in src/admin/ module, which requires the 'superadmin' role.
Must log to the audit trail (AuditService) before executing.
Claude should ask for explicit confirmation before writing any cross-tenant query.