import type { Workspace } from "../types/workspace-types";

/**
 * Workspace API layer. All workspace network calls belong here (AI_GUIDE:
 * never call axios/fetch directly from components).
 *
 * ⚠️ STUB: the backend does not yet expose workspace list/switch endpoints, and
 * AI_GUIDE forbids guessing API shapes. These functions return typed mock data
 * today and are structured so swapping in the real calls is a one-line change
 * per function once the contract exists. Do NOT scatter mock data elsewhere.
 */

const MOCK_WORKSPACES: Workspace[] = [
  { id: "ws_acme", name: "Acme Inc.", slug: "acme" },
  { id: "ws_globex", name: "Globex", slug: "globex" },
  { id: "ws_initech", name: "Initech", slug: "initech" },
];

/**
 * List the workspaces the current user is a member of.
 *
 * TODO(backend): replace the mock with the real call once `GET /workspaces`
 * is documented:
 *   const { data } = await apiClient.get<ApiResponse<Workspace[]>>("/workspaces");
 *   return data.data;
 */
export async function getWorkspaces(): Promise<Workspace[]> {
  return Promise.resolve(MOCK_WORKSPACES);
}

/**
 * Persist the active workspace server-side.
 *
 * TODO(backend): wire up once `POST /workspaces/switch` exists
 * (spec/layout.md → "API Integration"):
 *   await apiClient.post("/workspaces/switch", { workspaceId });
 */
export async function switchWorkspace(workspaceId: string): Promise<void> {
  void workspaceId; // consumed by the real POST once the contract is wired
  return Promise.resolve();
}
