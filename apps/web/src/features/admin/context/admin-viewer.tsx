"use client";

import { createContext, useContext } from "react";

import type { AdminViewer } from "../types/admin-types";

const AdminViewerContext = createContext<AdminViewer | null>(null);

/**
 * Who is looking at the admin console, from the admin layout's server-side
 * read of `GET /users/me`. Provided by `AdminShell`.
 */
export const AdminViewerProvider = AdminViewerContext.Provider;

/**
 * The viewer, plus `canAct`: only ADMIN may act (SUPPORT reads). UX only —
 * the backend refuses SUPPORT, yourself and other admins on every action.
 */
export function useAdminViewer() {
	const viewer = useContext(AdminViewerContext);
	if (!viewer) {
		throw new Error("useAdminViewer must be used inside AdminShell");
	}
	return { ...viewer, canAct: viewer.platformRole === "ADMIN" };
}
