import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Chip,
} from "@heroui/react";
import Link from "next/link";

import type { Project } from "../types/project-types";

export default function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/projects/${project.id}`} className="block h-full">
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardHeader className="flex-row items-start justify-between gap-2 pb-2">
          <CardTitle className="text-base">{project.name}</CardTitle>
          <Chip size="sm" variant="secondary">
            {project.key}
          </Chip>
        </CardHeader>

        <CardContent className="flex flex-col gap-3">
          {project.description && (
            <CardDescription className="line-clamp-2">
              {project.description}
            </CardDescription>
          )}

          <div className="mt-auto flex gap-2">
            <Chip size="sm" variant="soft">
              {project._count?.issues ?? 0} issues
            </Chip>
            <Chip size="sm" variant="soft">
              {project._count?.sprints ?? 0} sprints
            </Chip>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
