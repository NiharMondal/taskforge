"use client";

import { WorkspaceProvider } from "@/features/workspace/context/workspace-context";

import Header, { type HeaderUser } from "./Header";
import MobileSidebar from "./MobileSidebar";
import Sidebar from "./Sidebar";
import { SidebarProvider } from "./sidebar-context";

/**
 * Dashboard shell. Composes the workspace + sidebar providers around the
 * sidebar (fixed on desktop, drawer on mobile), the header, and the routed
 * page content. The server layout supplies the authenticated `user`.
 */
export default function AppLayout({
  user,
  children,
}: {
  user: HeaderUser;
  children: React.ReactNode;
}) {
  return (
    <WorkspaceProvider>
      <SidebarProvider>
        <div className="flex h-dvh overflow-hidden bg-background text-foreground">
          <Sidebar className="hidden md:flex" />
          <MobileSidebar />

          <div className="flex min-w-0 flex-1 flex-col">
            <Header user={user} />
            <main className="flex-1 overflow-y-auto p-6">{children}</main>
          </div>
        </div>
      </SidebarProvider>
    </WorkspaceProvider>
  );
}
