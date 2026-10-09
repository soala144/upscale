/**
 * Pure metric definitions for the overview dashboard. Keeping them free of I/O
 * makes every numerator/denominator testable.
 *
 * Definitions (documented in the UI as well):
 * - Lead cohort: leads created inside the selected range.
 * - Qualified: cohort leads currently HOT, WARM, PAYMENT_PENDING or CONVERTED.
 * - Conversion rate: CONVERTED leads / cohort leads. Null when the cohort is empty.
 * - Revenue: PAID customer purchases only, paid inside the range, per currency.
 * - Pending payments: customer purchases still PENDING (current state, not ranged).
 */

export const dashboardRanges = ["7d", "30d", "90d", "all"] as const;
export type DashboardRange = (typeof dashboardRanges)[number];

export const leadStages = [
  "NEW",
  "QUALIFYING",
  "HOT",
  "WARM",
  "COLD",
  "PAYMENT_PENDING",
  "CONVERTED",
] as const;
export type DashboardLeadStage = (typeof leadStages)[number];

const qualifiedStages: DashboardLeadStage[] = [
  "HOT",
  "WARM",
  "PAYMENT_PENDING",
  "CONVERTED",
];

export function parseRange(value: string | null | undefined): DashboardRange {
  return (dashboardRanges as readonly string[]).includes(value ?? "")
    ? (value as DashboardRange)
    : "30d";
}

/** Inclusive start of the range, or null for "all time". */
export function rangeStart(range: DashboardRange, now = new Date()): Date | null {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return new Date(now.getTime() - days * 86_400_000);
}

export type StageCounts = Record<DashboardLeadStage, number>;

export function emptyStageCounts(): StageCounts {
  return Object.fromEntries(leadStages.map((stage) => [stage, 0])) as StageCounts;
}

export function buildStageCounts(
  rows: Array<{ stage: string; count: number | string }>,
): StageCounts {
  const counts = emptyStageCounts();
  for (const row of rows) {
    if ((leadStages as readonly string[]).includes(row.stage)) {
      counts[row.stage as DashboardLeadStage] += Number(row.count);
    }
  }
  return counts;
}

export function totalLeads(counts: StageCounts) {
  return leadStages.reduce((sum, stage) => sum + counts[stage], 0);
}

export function qualifiedLeads(counts: StageCounts) {
  return qualifiedStages.reduce((sum, stage) => sum + counts[stage], 0);
}

/** Returns a 0..100 percentage rounded to one decimal, or null when undefined. */
export function percentage(numerator: number, denominator: number) {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export function conversionRate(counts: StageCounts) {
  return percentage(counts.CONVERTED, totalLeads(counts));
}

export function qualificationRate(counts: StageCounts) {
  return percentage(qualifiedLeads(counts), totalLeads(counts));
}

export type MoneyTotal = { currency: string; amount: string };

export type DailyPoint = { date: string; count: number };

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Zero-fills a daily series (UTC days) so charts show real gaps as zeros
 * rather than skipping dates.
 */
export function fillDailySeries(
  rows: Array<{ day: string; count: number | string }>,
  start: Date,
  end: Date,
): DailyPoint[] {
  const byDay = new Map<string, number>();
  for (const row of rows) {
    byDay.set(row.day.slice(0, 10), Number(row.count));
  }
  const points: DailyPoint[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cursor <= last) {
    const key = dayKey(cursor);
    points.push({ date: key, count: byDay.get(key) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return points;
}

/** Range used for the trend chart; "all" is capped to the last 90 days. */
export function chartWindow(range: DashboardRange, now = new Date()) {
  const start = rangeStart(range === "all" ? "90d" : range, now) as Date;
  return { start, end: now };
}
