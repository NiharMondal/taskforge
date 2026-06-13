"use client";

import { Button } from "@heroui/react";
import { Menu } from "lucide-react";

import { SignOutButton } from "@/features/auth/components/sign-out-button";

import { useSidebar } from "./sidebar-context";

/** Minimal, serializable view of the session user passed from the server layout. */
export interface HeaderUser {
  name?: string | null;
  email?: string | null;
}

/**
 * Top bar for the dashboard shell. Hosts the mobile drawer toggle (hidden on
 * desktop) and the current user / sign-out controls.
 */
export default function Header({ user }: { user: HeaderUser }) {
  const { toggle } = useSidebar();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-4">
      <Button
        isIconOnly
        variant="ghost"
        className="md:hidden"
        aria-label="Open navigation"
        onClick={toggle}
      >
        <Menu className="size-5" aria-hidden />
      </Button>

      <div className="ml-auto flex items-center gap-3">
        <span className="hidden text-sm text-muted sm:inline">
          {user.name ?? user.email}
        </span>
        <SignOutButton />
      </div>
    </header>
  );
}
