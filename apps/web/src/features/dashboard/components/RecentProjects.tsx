"use client";

import { Button, toast } from "@heroui/react";
import { useBoolean } from "ahooks";
import { ArrowRight, FolderPlus } from "lucide-react";
import Link from "next/link";

import { getApiErrorMessage } from "@/lib/api-error";
import { useWorkspacePermissions } from "@/features/memberships/hooks/use-workspace-permissions";
import ProjectCard from "@/features/projects/components/ProjectCard";
import ProjectFormModal from "@/features/projects/components/ProjectFormModal";
import { useCreateProject } from "@/features/projects/hooks/use-projects";
import type { TProjectFormValues } from "@/features/projects/schema/project-schema";
import type { Project } from "@/features/projects/types/project-types";
import { useWorkspace } from "@/features/workspace/context/workspace-context";

/**
 * "Recent projects" section for the dashboard. Reuses the canonical
 * {@link ProjectCard} so the dashboard and the Projects page stay visually in
 * sync, and falls back to a create-first-project empty state that opens the
 * project form in place.
 */
export default function RecentProjects({ projects }: { projects: Project[] }) {
  const [isOpen, { setTrue: openModal, setFalse: closeModal }] = useBoolean();
  const { activeWorkspaceId } = useWorkspace();
  const workspaceId = activeWorkspaceId ?? "";
  const { canManageProjects } = useWorkspacePermissions();

  const { mutateAsync: createProject, isPending: isCreating } =
    useCreateProject(workspaceId);

  const handleCreateProject = async (values: TProjectFormValues) => {
    try {
      const res = await createProject(values);
      if (res.success) {
        toast.success(res.message || "Project created successfully");
      }
      return true;
    } catch (error) {
      toast.danger(getApiErrorMessage(error, "Failed to create project"));
      return false;
    }
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recent projects</h2>
        {projects.length > 0 && (
          <Link
            href="/projects"
            className="flex items-center gap-1 text-sm text-accent hover:underline"
          >
            View all
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border py-16 text-center">
          <FolderPlus className="h-10 w-10 text-muted" />
          <div className="flex flex-col gap-1">
            <p className="font-medium">No projects yet</p>
            <p className="text-sm text-muted">
              {canManageProjects
                ? "Create a project to start tracking issues and sprints."
                : "Projects will appear here once an admin creates them."}
            </p>
          </div>
          {canManageProjects && (
            <Button variant="outline" onPress={openModal}>
              Create your first project
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              canManage={canManageProjects}
            />
          ))}
        </div>
      )}

      {canManageProjects && (
        <ProjectFormModal
          isOpen={isOpen}
          closeModal={closeModal}
          onSubmit={handleCreateProject}
          isSubmitting={isCreating}
        />
      )}
    </section>
  );
}
