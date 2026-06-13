import { cn } from "@heroui/react";

import CreateWorkspaceButton from "@/features/workspace/components/CreateWorkspaceButton";

import { NAV_ITEMS } from "./nav-items";
import SidebarItem from "./SidebarItem";
import WorkspaceSwitcher from "./WorkspaceSwitcher";

/**
 * The sidebar shell: workspace switcher on top, primary navigation below.
 * Purely presentational so it can be reused for both the fixed desktop rail
 * and the mobile drawer (see AppLayout / MobileSidebar).
 */
export default function Sidebar({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "flex w-64 flex-col border-r border-border bg-surface",
        className,
      )}
    >
      <div className="space-y-2 border-b border-border p-4">
        <WorkspaceSwitcher />
        <CreateWorkspaceButton />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {NAV_ITEMS.map((item) => (
          <SidebarItem key={item.href} {...item} />
        ))}
      </nav>
    </aside>
  );
}
