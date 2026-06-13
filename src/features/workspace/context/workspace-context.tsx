"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { useQueryClient } from "@tanstack/react-query";

import { setActiveWorkspaceId as setWorkspaceHeader } from "@/lib/active-workspace";

import { useWorkspaces } from "../hooks/use-workspaces";
import type { Workspace } from "../types/workspace-types";

/**
 * Active-workspace state for the dashboard shell.
 *
 * The *list* of workspaces is server state (React Query, see {@link useWorkspaces}).
 * The *selection* is client UI state, persisted to localStorage so a refresh
 * keeps the user in the same tenant. AI_GUIDE: prefer Context over prop drilling
 * and avoid Redux for state this small.
 */

const STORAGE_KEY = "taskforge.activeWorkspaceId";

interface WorkspaceContextValue {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string) => void;
  isLoading: boolean;
  isError: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { data: workspaces = [], isLoading, isError } = useWorkspaces();

  // The user's explicit choice, lazy-initialized from localStorage
  // (client-only; SSR renders with null).
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(STORAGE_KEY);
  });

  const setActiveWorkspaceId = useCallback(
    (id: string) => {
      setSelectedId(id);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, id);
      }
      // Tell the HTTP layer to scope subsequent requests to the new tenant...
      setWorkspaceHeader(id);
      // ...and drop cached server data, which all belonged to the previous
      // workspace, so every scoped query refetches under the new
      // `x-workspace-id` header (projects, issues, members, ...).
      queryClient.invalidateQueries();
    },
    [queryClient],
  );

  // Derive the active id during render rather than syncing it in an effect:
  // honor the stored choice if it's still valid, otherwise fall back to the
  // first workspace (e.g. on first visit or after access is revoked).
  const activeWorkspaceId = useMemo(() => {
    if (selectedId && workspaces.some((w) => w.id === selectedId)) {
      return selectedId;
    }
    return workspaces[0]?.id ?? null;
  }, [selectedId, workspaces]);

  // Keep the API client's `x-workspace-id` header in sync with the derived
  // selection. Done synchronously during render (not in an effect) so the very
  // first scoped request already carries the right tenant — child effects/
  // queries run before a parent effect would, and would otherwise race this.
  setWorkspaceHeader(activeWorkspaceId);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaces,
      activeWorkspaceId,
      activeWorkspace: workspaces.find((w) => w.id === activeWorkspaceId) ?? null,
      setActiveWorkspaceId,
      isLoading,
      isError,
    }),
    [workspaces, activeWorkspaceId, setActiveWorkspaceId, isLoading, isError],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

/** Read the active workspace. Throws if used outside {@link WorkspaceProvider}. */
export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return ctx;
}
