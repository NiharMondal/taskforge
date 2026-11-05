import { ForbiddenException } from "@nestjs/common";
import {
  ACCOUNT_SUSPENDED_ERROR_CODE,
  WORKSPACE_SUSPENDED_ERROR_CODE,
} from "@taskforge/shared";

/**
 * Suspensions by platform staff (`spec/admin-spec.md`). Both are 403s carrying
 * a `code`, so a client can tell them from a plain "not allowed". The staff's
 * reason is never in the body: it is an internal note.
 */

/** A suspended account signing in, verifying an email or refreshing a session. */
export class AccountSuspendedException extends ForbiddenException {
  constructor() {
    super({
      statusCode: 403,
      message:
        "This account has been suspended. Contact support if you think this is a mistake.",
      code: ACCOUNT_SUSPENDED_ERROR_CODE,
    });
  }
}

/** Any workspace-scoped request to a suspended workspace. */
export class WorkspaceSuspendedException extends ForbiddenException {
  constructor() {
    super({
      statusCode: 403,
      message:
        "This workspace has been suspended. Contact support if you think this is a mistake.",
      code: WORKSPACE_SUSPENDED_ERROR_CODE,
    });
  }
}
