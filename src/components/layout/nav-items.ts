import {
  FolderKanban,
  LayoutDashboard,
  Settings,
  type LucideIcon,
} from "lucide-react";

/** A single primary navigation entry in the sidebar. */
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/**
 * Primary dashboard navigation. Issues/boards are project-scoped
 * (`/projects/[id]/issues`), reached by drilling into a project — so they're
 * intentionally absent from the top-level rail rather than faked as global.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/settings", label: "Settings", icon: Settings },
];
