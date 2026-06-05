export interface Project {
  id: string;
  name: string;
  key: string;
  description?: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    issues: number;
    sprints: number;
  };
}

export interface CreateProjectDto {
  name: string;
  key: string;
  description?: string;
}
