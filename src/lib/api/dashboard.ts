import type { DashboardOverview } from "@/server/dashboard/service";
import type { DashboardRange } from "@/server/dashboard/metrics";

import { apiRequest } from "./client";

export type { DashboardOverview, DashboardRange };

export const getDashboardOverview = async (range: DashboardRange) =>
  (
    await apiRequest<{ overview: DashboardOverview }>(
      `/api/dashboard/overview?range=${range}`,
    )
  ).overview;
