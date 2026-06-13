import { redirect } from "next/navigation";

/**
 * Issues are project-scoped (`/projects/[projectId]/issues`) — there is no
 * workspace-wide issues endpoint. The old flat `/issues` link now sends users
 * to the project list to pick a project first.
 */
export default function IssuesPage() {
  redirect("/projects");
}
