import {
  FolderKanban,
  LayoutDashboard,
  ListTodo,
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
 * Primary dashboard navigation. Flat routes per spec/layout.md. When the app
 * moves to workspace-scoped routes (`/workspace/[id]/...`), build the hrefs
 * from the active workspace here.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/issues", label: "Issues", icon: ListTodo },
  { href: "/settings", label: "Settings", icon: Settings },
];
