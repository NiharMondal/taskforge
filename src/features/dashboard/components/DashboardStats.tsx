import { FolderKanban, ListTodo, Rocket, Users } from "lucide-react";

import type { DashboardStats } from "../hooks/use-dashboard-stats";
import StatCard from "./StatCard";

/** The four workspace-overview metrics, laid out as a responsive card row. */
export default function DashboardStatsRow({ stats }: { stats: DashboardStats }) {
  return (
    <section
      aria-label="Workspace overview"
      className="grid grid-cols-2 gap-4 lg:grid-cols-4"
    >
      <StatCard label="Projects" value={stats.projects} icon={FolderKanban} />
      <StatCard label="Open issues" value={stats.issues} icon={ListTodo} />
      <StatCard label="Sprints" value={stats.sprints} icon={Rocket} />
      <StatCard label="Members" value={stats.members} icon={Users} />
    </section>
  );
}
