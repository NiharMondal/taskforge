"use client";

import { Spinner } from "@heroui/react";

import { useWorkspace } from "@/features/workspace/context/workspace-context";

import { useDashboardStats } from "../hooks/use-dashboard-stats";
import DashboardStatsRow from "./DashboardStats";
import RecentProjects from "./RecentProjects";

/**
 * Workspace-overview dashboard. Reads the active workspace for the greeting and
 * derives stats/recent projects from React Query (see {@link useDashboardStats}).
 * Because every query is keyed by workspace id, switching workspaces refetches
 * this view automatically.
 */
export default function DashboardOverview({ userName }: { userName: string }) {
  const { activeWorkspace, activeWorkspaceId } = useWorkspace();
  const workspaceId = activeWorkspaceId ?? "";

  const { stats, recentProjects, isLoading, isError } =
    useDashboardStats(workspaceId);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold">Welcome back, {userName}</h1>
        <p className="mt-1 text-sm text-muted">
          {activeWorkspace
            ? `Here's what's happening in ${activeWorkspace.name}.`
            : "Pick a workspace from the sidebar to get started."}
        </p>
      </header>

      {isError ? (
        <p className="rounded-lg border border-border bg-surface p-6 text-sm text-danger">
          Couldn’t load your workspace overview. Please try again.
        </p>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner />
        </div>
      ) : (
        <>
          <DashboardStatsRow stats={stats} />
          <RecentProjects projects={recentProjects} />
        </>
      )}
    </div>
  );
}
