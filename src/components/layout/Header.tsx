"use client";

import { Button } from "@heroui/react";
import { Menu } from "lucide-react";
import { useSession } from "next-auth/react";

import Avatar from "@/components/ui/avatar";
import { SignOutButton } from "@/features/auth/components/sign-out-button";

import { useSidebar } from "./sidebar-context";

/** Minimal, serializable view of the session user passed from the server layout. */
export interface HeaderUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

/** Initials for the avatar fallback, e.g. "Ada Lovelace" -> "AL". */
function initialsOf(value?: string | null): string {
  if (!value) return "?";
  return (
    value
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

/**
 * Top bar for the dashboard shell. Hosts the mobile drawer toggle (hidden on
 * desktop) and the current user / sign-out controls.
 *
 * The server layout provides `user` for first paint; `useSession()` then keeps
 * the name/avatar live so a profile save (which calls `update()`) reflects
 * here immediately, without a reload.
 */
export default function Header({ user }: { user: HeaderUser }) {
  const { toggle } = useSidebar();
  const { data: session } = useSession();

  const name = session?.user?.name ?? user.name;
  const email = session?.user?.email ?? user.email;
  const image = session?.user?.image ?? user.image;

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
        <Avatar
          src={image ?? undefined}
          fallback={initialsOf(name ?? email)}
          alt={name ?? "Profile photo"}
          size="sm"
        />
        <span className="hidden text-sm text-muted sm:inline">
          {name ?? email}
        </span>
        <SignOutButton />
      </div>
    </header>
  );
}
