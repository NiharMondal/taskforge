# Health Check — Backend Spec

## Goal

A URL that hosting platforms and uptime monitors can poll, and that fails when the API can't reach its database. `GET /` only says hello and stays as it is.

## API Endpoint

### `GET /health`

Public: no `Authorization` header and no `x-workspace-id`. Not throttled. Runs `SELECT 1` against the database.

**200** while the database answers:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Healthy",
  "data": { "status": "ok", "db": "ok", "uptime": 5321 }
}
```

`uptime` is the process's uptime in whole seconds.

**503** when the query fails, or doesn't answer within 3 seconds (`HEALTH_DB_TIMEOUT_MS`; the connection pool would otherwise wait indefinitely):

```json
{
  "success": false,
  "statusCode": 503,
  "message": "Database unavailable",
  "status": "error",
  "db": "down"
}
```

The cause is logged on the server and never sent: database errors can name the host or user.

## Not included

- No other dependencies are checked (SMTP, Stripe, Cloudinary). Their failures affect single features, not whether the API is up.
- No `@nestjs/terminus`: one check doesn't need it.
