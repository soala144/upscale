import { LeadDetailPage } from "@/components/dashboard/lead-detail-page";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";

export default function LeadDetailRoute() {
  return <WorkspaceShell><LeadDetailPage /></WorkspaceShell>;
}
