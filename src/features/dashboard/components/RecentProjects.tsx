import { ArrowRight, FolderPlus } from "lucide-react";
import Link from "next/link";

import ProjectCard from "@/features/projects/components/ProjectCard";
import type { Project } from "@/features/projects/types/project-types";

/**
 * "Recent projects" section for the dashboard. Reuses the canonical
 * {@link ProjectCard} so the dashboard and the Projects page stay visually in
 * sync, and falls back to a create-first-project empty state.
 */
export default function RecentProjects({ projects }: { projects: Project[] }) {
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
              Create a project to start tracking issues and sprints.
            </p>
          </div>
          <Link
            href="/projects"
            className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-secondary"
          >
            Create your first project
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </section>
  );
}
