import { Card, CardContent } from "@heroui/react";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
}

/** A single overview metric (presentational — no data fetching). */
export default function StatCard({ label, value, icon: Icon }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <Icon className="h-5 w-5" />
        </span>
        <div className="flex flex-col">
          <span className="text-2xl font-semibold leading-none tabular-nums">
            {value}
          </span>
          <span className="mt-1 text-sm text-muted">{label}</span>
        </div>
      </CardContent>
    </Card>
  );
}
