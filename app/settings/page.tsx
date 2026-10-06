import { SettingsPage } from "@/components/dashboard/settings-page";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";

export default function SettingsRoute() {
  return <WorkspaceShell><SettingsPage /></WorkspaceShell>;
}
