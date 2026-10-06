import { PaymentsPage } from "@/components/dashboard/payments-page";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";

export default function PaymentsRoute() {
  return <WorkspaceShell><PaymentsPage /></WorkspaceShell>;
}
