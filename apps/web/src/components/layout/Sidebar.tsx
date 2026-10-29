import { cn } from "@heroui/react";
import { Anvil } from "lucide-react";
import Link from "next/link";

import { NAV_ITEMS } from "./nav-items";
import SidebarItem from "./SidebarItem";
import WorkspaceMenu from "./WorkspaceMenu";

/**
 * The sidebar shell: the brand on top (as tall as the header, so their
 * borders line up), primary navigation, and the workspace menu pinned to the
 * bottom — switch or create a workspace, sign out. Purely presentational so it
 * can be reused for both the fixed desktop rail and the mobile drawer (see
 * AppLayout / MobileSidebar).
 */
export default function Sidebar({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "flex w-64 flex-col border-r border-border bg-surface",
        className,
      )}
    >
      <div className="flex h-14 shrink-0 items-center border-b border-border px-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-md text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Anvil className="size-4" aria-hidden />
          </span>
          TaskForge
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {NAV_ITEMS.map((item) => (
          <SidebarItem key={item.href} {...item} />
        ))}
      </nav>

      <div className="shrink-0 border-t border-border p-2">
        <WorkspaceMenu />
      </div>
    </aside>
  );
}
