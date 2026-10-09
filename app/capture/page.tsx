import { CapturePage } from "@/components/dashboard/capture-page";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";

export default function CaptureRoute() {
  return <WorkspaceShell><CapturePage /></WorkspaceShell>;
}
