"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@heroui/react";

import type { NavItem } from "./nav-items";

/**
 * A single sidebar link with active-route highlighting. Presentational — the
 * nav config lives in {@link NavItem}.
 */
export default function SidebarItem({ href, label, icon: Icon }: NavItem) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-muted hover:bg-surface-hover hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {label}
    </Link>
  );
}
