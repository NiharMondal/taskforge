import { apiClient } from "@/lib/axios";

import type { ApiResponse } from "@/types/api";

import type { Project, CreateProjectDto } from "../types/project-types";

/**
 * Project API layer. All project network calls belong here (AI_GUIDE: never
 * call axios/fetch directly from components).
 *
 * These endpoints are workspace-scoped via the `x-workspace-id` header that the
 * axios interceptor attaches automatically (see `lib/active-workspace`), so the
 * routes themselves carry no workspace id — switching workspaces transparently
 * changes which tenant's projects come back.
 */

/** List the active workspace's projects (`GET /projects`). */
export async function getProjects(): Promise<Project[]> {
  const { data } = await apiClient.get<ApiResponse<Project[]>>("/projects");
  return data.data;
}

/** Create a project in the active workspace (`POST /projects`). */
export async function createProject(dto: CreateProjectDto): Promise<Project> {
  const { data } = await apiClient.post<ApiResponse<Project>>("/projects", dto);
  return data.data;
}
