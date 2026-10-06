import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import { OverviewPage } from "@/components/dashboard/overview-page";

export default function OverviewRoute() {
  return <WorkspaceShell><OverviewPage /></WorkspaceShell>;
}
