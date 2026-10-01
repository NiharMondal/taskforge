# 🗂️ Projects Feature Specification

## 🎯 Objective

Build the Projects page — a workspace-scoped list of projects with a create-project flow.

The page must:

* Display all projects belonging to the active workspace
* Allow creating a new project via a modal form
* Navigate to individual project detail pages
* Show an empty state when no projects exist

---

## 🏗️ Architecture Overview

```
WorkspaceContext (active workspaceId)
  ↓
useProjects(workspaceId)          ← React Query
  ↓
project-api.ts                    ← axios calls
  ↓
Backend API  GET /workspaces/:workspaceId/projects
             POST /workspaces/:workspaceId/projects
```

Hierarchy reminder:

```
Workspace
  └─ Projects   ← this feature
      ├─ Issues
      └─ Sprints
```

---

## 📁 File Structure

```
src/
  features/projects/
    api/
      project-api.ts              # all axios calls for projects
    types/
      project-types.ts            # Project, CreateProjectDto
    hooks/
      use-projects.ts             # useProjects, useCreateProject
    components/
      ProjectCard.tsx             # single project card
      ProjectList.tsx             # grid + empty state
      CreateProjectModal.tsx      # modal with form

  app/(dashboard)/projects/
    page.tsx                      # replace existing placeholder
```

---

## 🧩 TypeScript Types

### `src/features/projects/types/project-types.ts`

```ts
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
```

---

## 🔌 API Layer

### `src/features/projects/api/project-api.ts`

```ts
import apiClient from "@/lib/api-client";
import { Project, CreateProjectDto } from "../types/project-types";

// Mock data — swap for real API calls when backend is ready
const MOCK_PROJECTS: Project[] = [
  {
    id: "1",
    name: "Engineering",
    key: "ENG",
    description: "Core platform development",
    workspaceId: "ws-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _count: { issues: 12, sprints: 2 },
  },
  {
    id: "2",
    name: "Design System",
    key: "DS",
    description: "Component library and tokens",
    workspaceId: "ws-1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _count: { issues: 5, sprints: 1 },
  },
];

export async function getProjects(workspaceId: string): Promise<Project[]> {
  // TODO: replace with real API call
  // const { data } = await apiClient.get<{ data: Project[] }>(
  //   `/workspaces/${workspaceId}/projects`
  // );
  // return data.data;
  return MOCK_PROJECTS;
}

export async function createProject(
  workspaceId: string,
  dto: CreateProjectDto
): Promise<Project> {
  // TODO: replace with real API call
  // const { data } = await apiClient.post<{ data: Project }>(
  //   `/workspaces/${workspaceId}/projects`,
  //   dto
  // );
  // return data.data;
  const newProject: Project = {
    id: String(Date.now()),
    ...dto,
    workspaceId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _count: { issues: 0, sprints: 0 },
  };
  return newProject;
}
```

---

## 🪝 React Query Hooks

### `src/features/projects/hooks/use-projects.ts`

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getProjects, createProject } from "../api/project-api";
import { CreateProjectDto } from "../types/project-types";

export function useProjects(workspaceId: string) {
  return useQuery({
    queryKey: ["projects", workspaceId],
    queryFn: () => getProjects(workspaceId),
    enabled: !!workspaceId,
  });
}

export function useCreateProject(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateProjectDto) => createProject(workspaceId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", workspaceId] });
    },
  });
}
```

---

## 🃏 Components

### `ProjectCard.tsx`

Displays a single project. Links to `/projects/:id`.

```tsx
import { Card, CardBody, Chip } from "@heroui/react";
import Link from "next/link";
import { Project } from "../types/project-types";

export default function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/projects/${project.id}`}>
      <Card isPressable className="h-full">
        <CardBody className="gap-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">{project.name}</span>
            <Chip size="sm" variant="flat" color="primary">
              {project.key}
            </Chip>
          </div>
          {project.description && (
            <p className="text-sm text-default-500 line-clamp-2">
              {project.description}
            </p>
          )}
          <div className="flex gap-2 mt-auto">
            <Chip size="sm" variant="bordered">
              {project._count?.issues ?? 0} issues
            </Chip>
            <Chip size="sm" variant="bordered">
              {project._count?.sprints ?? 0} sprints
            </Chip>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}
```

---

### `ProjectList.tsx`

Renders the grid of cards or an empty state.

```tsx
import { Button } from "@heroui/react";
import { FolderPlus } from "lucide-react";
import { Project } from "../types/project-types";
import ProjectCard from "./ProjectCard";

interface ProjectListProps {
  projects: Project[];
  onCreateClick: () => void;
}

export default function ProjectList({ projects, onCreateClick }: ProjectListProps) {
  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <FolderPlus className="w-12 h-12 text-default-300" />
        <p className="text-default-500">No projects yet.</p>
        <Button color="primary" onPress={onCreateClick}>
          Create your first project
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
```

---

### `CreateProjectModal.tsx`

Modal with React Hook Form + Zod. Key is auto-derived from the name (uppercase letters only, max 8 chars) and remains user-editable.

```tsx
"use client";

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
} from "@heroui/react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateProjectDto } from "../types/project-types";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  key: z
    .string()
    .min(1, "Key is required")
    .max(8, "Key must be 8 characters or fewer")
    .regex(/^[A-Z0-9]+$/, "Key must be uppercase letters and numbers only"),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (dto: CreateProjectDto) => Promise<void>;
  isLoading?: boolean;
}

function deriveKey(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

export default function CreateProjectModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: CreateProjectModalProps) {
  const {
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", key: "", description: "" },
  });

  const handleNameChange = (value: string) => {
    setValue("name", value);
    setValue("key", deriveKey(value));
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const submit = async (values: FormValues) => {
    await onSubmit(values);
    handleClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <ModalContent>
        <form onSubmit={handleSubmit(submit)}>
          <ModalHeader>New Project</ModalHeader>
          <ModalBody className="gap-4">
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  label="Project Name"
                  placeholder="e.g. Engineering"
                  isInvalid={!!errors.name}
                  errorMessage={errors.name?.message}
                  onValueChange={handleNameChange}
                />
              )}
            />
            <Controller
              name="key"
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  label="Project Key"
                  placeholder="e.g. ENG"
                  description="Short identifier used for issue prefixes (e.g. ENG-1)"
                  isInvalid={!!errors.key}
                  errorMessage={errors.key?.message}
                  onValueChange={(v) => field.onChange(v.toUpperCase())}
                />
              )}
            />
            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <Textarea
                  {...field}
                  label="Description"
                  placeholder="Optional project description"
                  isInvalid={!!errors.description}
                  errorMessage={errors.description?.message}
                />
              )}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={handleClose}>
              Cancel
            </Button>
            <Button color="primary" type="submit" isLoading={isLoading}>
              Create Project
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
```

---

## 📄 Page

### `src/app/(dashboard)/projects/page.tsx`

```tsx
"use client";

import { useState } from "react";
import { Button } from "@heroui/react";
import { Plus } from "lucide-react";
import { useWorkspace } from "@/features/workspace/context/workspace-context";
import { useProjects, useCreateProject } from "@/features/projects/hooks/use-projects";
import ProjectList from "@/features/projects/components/ProjectList";
import CreateProjectModal from "@/features/projects/components/CreateProjectModal";
import { CreateProjectDto } from "@/features/projects/types/project-types";

export default function ProjectsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id ?? "";

  const { data: projects = [], isLoading } = useProjects(workspaceId);
  const { mutateAsync: createProject, isPending } = useCreateProject(workspaceId);

  const handleCreate = async (dto: CreateProjectDto) => {
    await createProject(dto);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Button
          color="primary"
          startContent={<Plus className="w-4 h-4" />}
          onPress={() => setIsModalOpen(true)}
        >
          New Project
        </Button>
      </div>

      {isLoading ? (
        <p className="text-default-400">Loading projects...</p>
      ) : (
        <ProjectList
          projects={projects}
          onCreateClick={() => setIsModalOpen(true)}
        />
      )}

      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreate}
        isLoading={isPending}
      />
    </div>
  );
}
```

---

## ✅ Expected Backend Contract

### List Projects

```
GET /workspaces/:workspaceId/projects
Authorization: Bearer <token>

Response:
{
  "data": [
    {
      "id": "uuid",
      "name": "Engineering",
      "key": "ENG",
      "description": "...",
      "workspaceId": "uuid",
      "createdAt": "iso",
      "updatedAt": "iso",
      "_count": { "issues": 12, "sprints": 2 }
    }
  ]
}
```

### Create Project

```
POST /workspaces/:workspaceId/projects
Authorization: Bearer <token>
Content-Type: application/json

Body:
{
  "name": "Engineering",
  "key": "ENG",
  "description": "optional"
}

Response:
{
  "data": { ...Project }
}

Error (duplicate key):
HTTP 409 — { "message": "Project key already exists in this workspace" }
```

---

## ⚠️ Rules (STRICT)

1. NEVER fetch projects without a `workspaceId` — guard with `enabled: !!workspaceId`
2. NEVER call API functions directly inside components — always go through hooks
3. ALL API calls live in `project-api.ts` only
4. Use HeroUI components (`Card`, `Modal`, `Input`, `Button`, `Chip`) — no raw HTML form elements
5. On a 409 response from create, surface the error as a field-level error on the `key` input
6. The project key auto-derives from the name but must remain user-editable
7. Keep `ProjectCard`, `ProjectList`, and `CreateProjectModal` as presentational components — no data fetching inside them

---

## 🚀 Deliverables for Claude

Claude must:

* Create all files under `src/features/projects/`
* Replace the placeholder `src/app/(dashboard)/projects/page.tsx`
* Use mock data (matching the pattern in `workspace-api.ts`) with real API calls commented out
* Ensure the modal form validates with Zod before submitting
* Ensure key auto-derives from name on every keystroke, stays editable

---

## ✅ Definition of Done

* `/projects` page renders a grid of project cards from mock data
* "New Project" button opens the create modal
* Typing a project name auto-populates the key field (editable)
* Submitting the form closes the modal and the new project appears in the list
* Empty state with CTA is shown when no projects exist
* Layout is responsive (single column on mobile, 3-column on desktop)
