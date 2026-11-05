export interface Project {
  id: string;
  name: string;
  key: string;
  description?: string | null;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    issues: number;
    sprints: number;
  };
}

/** `POST /projects`. */
export interface CreateProjectDto {
  name: string;
  description?: string | null;
  /** Start with a copy of this project's workflow (Pro; a 402 on Free). */
  workflowFromProjectId?: string;
}
