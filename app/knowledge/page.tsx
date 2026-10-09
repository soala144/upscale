import { KnowledgePage } from "@/components/dashboard/knowledge-page";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";

export default function KnowledgeRoute() {
  return <WorkspaceShell><KnowledgePage /></WorkspaceShell>;
}
