import { useMutation } from "@tanstack/react-query";

import { changePassword } from "../api/auth-api";
import type { ChangePasswordRequest } from "../types/auth-types";

/**
 * `PATCH /auth/password`. Nothing to invalidate: a success ends the session,
 * and the caller signs out.
 */
export function useChangePassword() {
	return useMutation({
		mutationFn: (payload: ChangePasswordRequest) => changePassword(payload),
	});
}
