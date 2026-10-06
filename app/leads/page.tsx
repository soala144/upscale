import { LeadsPage } from "@/components/dashboard/leads-page";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";

export default function LeadsRoute() {
  return <WorkspaceShell><LeadsPage /></WorkspaceShell>;
}
