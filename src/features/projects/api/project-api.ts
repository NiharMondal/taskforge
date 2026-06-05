import type { Project, CreateProjectDto } from "../types/project-types";

/**
 * Project API layer. All project network calls belong here.
 *
 * ⚠️ STUB: backend endpoints not yet available. Functions return typed mock
 * data and are structured so swapping in the real axios calls is a one-liner
 * per function. Real calls are commented out inline.
 */

const MOCK_PROJECTS: Project[] = [
  {
    id: "proj_eng",
    name: "Engineering",
    key: "ENG",
    description: "Core platform development",
    workspaceId: "ws_acme",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _count: { issues: 12, sprints: 2 },
  },
  {
    id: "proj_ds",
    name: "Design System",
    key: "DS",
    description: "Component library and design tokens",
    workspaceId: "ws_acme",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _count: { issues: 5, sprints: 1 },
  },
  {
    id: "proj_mkt",
    name: "Marketing",
    key: "MKT",
    workspaceId: "ws_acme",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _count: { issues: 3, sprints: 0 },
  },
];

// In-memory store for mock creates so the list updates within a session.
let mockStore = [...MOCK_PROJECTS];

/**
 * List projects for a workspace.
 *
 * TODO(backend): replace mock with real call once GET /workspaces/:id/projects
 * is documented:
 *   const { data } = await apiClient.get<{ data: Project[] }>(
 *     `/workspaces/${workspaceId}/projects`
 *   );
 *   return data.data;
 */
export async function getProjects(workspaceId: string): Promise<Project[]> {
  return Promise.resolve(mockStore.filter((p) => p.workspaceId === workspaceId));
}

/**
 * Create a project within a workspace.
 *
 * TODO(backend): replace mock with real call once POST /workspaces/:id/projects
 * is documented:
 *   const { data } = await apiClient.post<{ data: Project }>(
 *     `/workspaces/${workspaceId}/projects`,
 *     dto
 *   );
 *   return data.data;
 */
export async function createProject(
  workspaceId: string,
  dto: CreateProjectDto,
): Promise<Project> {
  const project: Project = {
    id: `proj_${Date.now()}`,
    ...dto,
    workspaceId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _count: { issues: 0, sprints: 0 },
  };
  mockStore = [...mockStore, project];
  return Promise.resolve(project);
}
