"use client";

import { use } from "react";

import IssuesView from "@/features/issues/components/IssuesView";

/**
 * Project-scoped issues route: `/projects/[projectId]/issues`.
 *
 * `params` is a Promise in Next 16; this is a client component (the view owns
 * modal/query state), so we unwrap it with React's `use()` rather than `await`.
 */
export default function ProjectIssuesPage({
  params,
}: PageProps<"/projects/[projectId]/issues">) {
  const { projectId } = use(params);
  return <IssuesView projectId={projectId} />;
}
