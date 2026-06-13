"use client";

import { useMemo } from "react";

import { useMemberships } from "@/features/memberships/hooks/use-memberships";
import { useProjects } from "@/features/projects/hooks/use-projects";
import type { Project } from "@/features/projects/types/project-types";

/**
 * Derives the workspace-overview dashboard from data the documented API already
 * provides cheaply: the projects list (each project carries `_count.issues` and
 * `_count.sprints`) and the membership roster. There is no analytics endpoint,
 * so issue/sprint totals are summed client-side from the per-project counts —
 * no N+1 fan-out across `/projects/:id/issues`.
 */

export interface DashboardStats {
  projects: number;
  issues: number;
  sprints: number;
  members: number;
}

/** How many of the most-recently-updated projects to surface on the dashboard. */
const RECENT_PROJECTS_LIMIT = 6;

export function useDashboardStats(workspaceId: string) {
  const projectsQuery = useProjects(workspaceId);
  const membershipsQuery = useMemberships(workspaceId);

  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);
  const memberCount = membershipsQuery.data?.length ?? 0;

  const stats = useMemo<DashboardStats>(
    () => ({
      projects: projects.length,
      issues: projects.reduce((sum, p) => sum + (p._count?.issues ?? 0), 0),
      sprints: projects.reduce((sum, p) => sum + (p._count?.sprints ?? 0), 0),
      members: memberCount,
    }),
    [projects, memberCount],
  );

  const recentProjects = useMemo<Project[]>(
    () =>
      [...projects]
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )
        .slice(0, RECENT_PROJECTS_LIMIT),
    [projects],
  );

  return {
    stats,
    recentProjects,
    // Members load independently; the page is "ready" once projects are in, so
    // a slow roster never blocks the stat cards or project grid.
    isLoading: projectsQuery.isLoading,
    isError: projectsQuery.isError,
  };
}
