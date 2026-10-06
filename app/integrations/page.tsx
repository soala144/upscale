import { IntegrationsPage } from "@/components/dashboard/integrations-page";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";

export default function IntegrationsRoute() {
  return <WorkspaceShell><IntegrationsPage /></WorkspaceShell>;
}
