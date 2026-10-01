"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { cn } from "@heroui/react";

import Sidebar from "./Sidebar";
import { useSidebar } from "./sidebar-context";

/**
 * Mobile-only sliding sidebar. Hand-rolled drawer (per spec/layout.md's
 * suggested approach) controlled by `useSidebar()`: a backdrop + a panel that
 * slides in from the left. Hidden at `md` and up, where the fixed Sidebar shows.
 */
export default function MobileSidebar() {
  const { isOpen, close } = useSidebar();
  const pathname = usePathname();

  // Close the drawer on navigation so it never lingers over a new page.
  useEffect(() => {
    close();
  }, [pathname, close]);

  // While open: close on Escape and lock background scroll.
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, close]);

  return (
    <div className="md:hidden">
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={close}
        className={cn(
          "fixed inset-0 z-40 bg-backdrop/60 transition-opacity duration-200",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      {/* Sliding panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sidebar navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out",
          isOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Sidebar className="h-full" />
      </div>
    </div>
  );
}
