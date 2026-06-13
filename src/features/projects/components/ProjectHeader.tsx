"use client";

import type { ReactNode } from "react";

import { Chip, cn } from "@heroui/react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import type { Project } from "../types/project-types";

type ProjectTab = "issues" | "board";

interface ProjectHeaderProps {
  projectId: string;
  project?: Project;
  active: ProjectTab;
  /** Right-aligned page action (e.g. the "New Issue" button). */
  actions?: ReactNode;
}

/**
 * Shared chrome for project-scoped pages: back link, project identity, and the
 * Issues/Board tab bar. Lives here (not in a route layout) so each page keeps
 * ownership of its own action button while sharing identical navigation.
 */
export default function ProjectHeader({
  projectId,
  project,
  active,
  actions,
}: ProjectHeaderProps) {
  const tabs: { key: ProjectTab; label: string; href: string }[] = [
    { key: "issues", label: "Issues", href: `/projects/${projectId}/issues` },
    { key: "board", label: "Board", href: `/projects/${projectId}/board` },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/projects"
        className="flex w-fit items-center gap-1 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Projects
      </Link>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{project?.name ?? "Project"}</h1>
          {project && (
            <Chip size="sm" variant="secondary">
              {project.key}
            </Chip>
          )}
        </div>
        {actions}
      </div>

      <nav className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={tab.key === active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab.key === active
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
