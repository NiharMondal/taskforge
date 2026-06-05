import { Button } from "@heroui/react";
import { FolderPlus } from "lucide-react";

import type { Project } from "../types/project-types";
import ProjectCard from "./ProjectCard";

interface ProjectListProps {
  projects: Project[];
  onCreateClick: () => void;
}

export default function ProjectList({ projects, onCreateClick }: ProjectListProps) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
        <FolderPlus className="h-12 w-12 text-muted-foreground/40" />
        <div className="flex flex-col gap-1">
          <p className="font-medium">No projects yet</p>
          <p className="text-sm text-muted-foreground">
            Create a project to start tracking issues and sprints.
          </p>
        </div>
        <Button variant="outline" onPress={onCreateClick}>
          Create your first project
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
