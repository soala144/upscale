import { Suspense } from "react";

import { CalendarPage } from "@/components/dashboard/calendar-page";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";

export default function CalendarRoute() {
  return <WorkspaceShell><Suspense><CalendarPage /></Suspense></WorkspaceShell>;
}
