import { Suspense } from "react";

import { BillingPage } from "@/components/dashboard/billing-page";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";

export default function BillingRoute() {
  return <WorkspaceShell><Suspense><BillingPage /></Suspense></WorkspaceShell>;
}
