import SettingsView from "@/features/settings/components/SettingsView";

/**
 * Workspace settings: `/settings`. The `(dashboard)` layout provides the shell
 * (sidebar, header, auth gate); the client view reads the active workspace
 * from context and its members/invitations from React Query.
 */
export default function SettingsPage() {
  return <SettingsView />;
}
