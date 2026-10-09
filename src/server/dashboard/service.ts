import "server-only";

import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { getDatabase } from "@/db";
import { appointments } from "@/db/schema/appointments";
import { broadcastCampaigns, broadcastRecipients } from "@/db/schema/broadcast";
import { conversations } from "@/db/schema/conversations";
import { leads } from "@/db/schema/leads";
import { payments } from "@/db/schema/payments";
import { captureError } from "@/server/integrations/watchup";
import { getErrorName, logger } from "@/server/logging";

import {
  buildStageCounts,
  chartWindow,
  conversionRate,
  fillDailySeries,
  qualificationRate,
  qualifiedLeads,
  rangeStart,
  totalLeads,
  type DailyPoint,
  type DashboardRange,
  type MoneyTotal,
  type StageCounts,
} from "./metrics";

export type Section<T> = { ok: true; data: T } | { ok: false };

async function section<T>(name: string, run: () => Promise<T>): Promise<Section<T>> {
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    logger.error("dashboard.section.failed", {
      section: name,
      errorName: getErrorName(error),
    });
    captureError(error, `dashboard.${name}`);
    return { ok: false };
  }
}

export type DashboardOverview = {
  range: DashboardRange;
  generatedAt: string;
  leads: Section<{
    total: number;
    qualified: number;
    qualificationRate: number | null;
    converted: number;
    conversionRate: number | null;
    stages: StageCounts;
    sources: Array<{ source: string; count: number }>;
    trend: DailyPoint[];
  }>;
  payments: Section<{
    revenue: MoneyTotal[];
    paidCount: number;
    pendingCount: number;
    pendingAmount: MoneyTotal[];
  }>;
  conversations: Section<
    Array<{
      id: string;
      leadId: string;
      leadName: string | null;
      channel: string;
      stage: string;
      lastMessage: string | null;
      updatedAt: string;
    }>
  >;
  appointments: Section<
    Array<{
      id: string;
      title: string;
      type: string;
      status: string;
      startsAt: string;
      endsAt: string;
      leadId: string | null;
      leadName: string | null;
    }>
  >;
  broadcasts: Section<
    Array<{
      id: string;
      name: string;
      status: string;
      createdAt: string;
      recipients: number;
      sent: number;
      failed: number;
      skipped: number;
    }>
  >;
};

async function leadSection(organizationId: string, range: DashboardRange, now: Date) {
  const db = getDatabase();
  const start = rangeStart(range, now);
  const cohort = start
    ? and(eq(leads.organizationId, organizationId), gte(leads.createdAt, start))
    : eq(leads.organizationId, organizationId);
  const window = chartWindow(range, now);

  const [stageRows, sourceRows, trendRows] = await Promise.all([
    db
      .select({ stage: leads.stage, count: sql<number>`count(*)::int` })
      .from(leads)
      .where(cohort)
      .groupBy(leads.stage),
    db
      .select({
        source: sql<string>`coalesce(${leads.source}, 'Unknown')`,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .where(cohort)
      .groupBy(sql`coalesce(${leads.source}, 'Unknown')`)
      .orderBy(desc(sql`count(*)`)),
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${leads.createdAt} at time zone 'UTC'), 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(leads)
      .where(
        and(
          eq(leads.organizationId, organizationId),
          gte(leads.createdAt, window.start),
        ),
      )
      .groupBy(sql`1`),
  ]);

  const stages = buildStageCounts(stageRows);
  return {
    total: totalLeads(stages),
    qualified: qualifiedLeads(stages),
    qualificationRate: qualificationRate(stages),
    converted: stages.CONVERTED,
    conversionRate: conversionRate(stages),
    stages,
    sources: sourceRows,
    trend: fillDailySeries(trendRows, window.start, window.end),
  };
}

async function paymentSection(organizationId: string, range: DashboardRange, now: Date) {
  const db = getDatabase();
  const start = rangeStart(range, now);
  const customerPurchase = and(
    eq(payments.organizationId, organizationId),
    eq(payments.type, "CUSTOMER_PURCHASE"),
  );

  const [paidRows, pendingRows] = await Promise.all([
    db
      .select({
        currency: payments.currency,
        amount: sql<string>`sum(${payments.amount})::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(payments)
      .where(
        and(
          customerPurchase,
          eq(payments.status, "PAID"),
          // Paid time is the last status change; there is no separate paid_at column.
          start ? gte(payments.updatedAt, start) : undefined,
        ),
      )
      .groupBy(payments.currency),
    db
      .select({
        currency: payments.currency,
        amount: sql<string>`sum(${payments.amount})::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(payments)
      .where(and(customerPurchase, eq(payments.status, "PENDING")))
      .groupBy(payments.currency),
  ]);

  return {
    revenue: paidRows.map(({ currency, amount }) => ({ currency, amount })),
    paidCount: paidRows.reduce((sum, row) => sum + row.count, 0),
    pendingCount: pendingRows.reduce((sum, row) => sum + row.count, 0),
    pendingAmount: pendingRows.map(({ currency, amount }) => ({ currency, amount })),
  };
}

async function conversationSection(organizationId: string) {
  const rows = await getDatabase()
    .select({
      id: conversations.id,
      leadId: conversations.leadId,
      leadName: leads.name,
      channel: conversations.channel,
      stage: leads.stage,
      updatedAt: conversations.updatedAt,
      lastMessage: sql<string | null>`(
        select m.content from messages m
        where m.conversation_id = ${conversations.id}
        order by m.created_at desc limit 1
      )`,
    })
    .from(conversations)
    .innerJoin(leads, eq(leads.id, conversations.leadId))
    .where(
      and(
        eq(conversations.organizationId, organizationId),
        eq(leads.organizationId, organizationId),
      ),
    )
    .orderBy(desc(conversations.updatedAt))
    .limit(5);

  return rows.map((row) => ({
    ...row,
    lastMessage: row.lastMessage ? row.lastMessage.slice(0, 140) : null,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

async function appointmentSection(organizationId: string, now: Date) {
  const rows = await getDatabase()
    .select({
      id: appointments.id,
      title: appointments.title,
      type: appointments.type,
      status: appointments.status,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      leadId: appointments.leadId,
      leadName: sql<string | null>`coalesce(${leads.name}, ${appointments.leadName})`,
    })
    .from(appointments)
    .leftJoin(leads, eq(leads.id, appointments.leadId))
    .where(
      and(
        eq(appointments.organizationId, organizationId),
        gte(appointments.endsAt, now),
        inArray(appointments.status, ["SCHEDULED", "CONFIRMED"]),
      ),
    )
    .orderBy(asc(appointments.startsAt))
    .limit(5);

  return rows.map((row) => ({
    ...row,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
  }));
}

async function broadcastSection(organizationId: string) {
  const rows = await getDatabase()
    .select({
      id: broadcastCampaigns.id,
      name: broadcastCampaigns.name,
      status: broadcastCampaigns.status,
      createdAt: broadcastCampaigns.createdAt,
      recipients: sql<number>`count(${broadcastRecipients.id})::int`,
      sent: sql<number>`count(*) filter (where ${broadcastRecipients.status} = 'SENT')::int`,
      failed: sql<number>`count(*) filter (where ${broadcastRecipients.status} = 'FAILED')::int`,
      skipped: sql<number>`count(*) filter (where ${broadcastRecipients.status} = 'SKIPPED')::int`,
    })
    .from(broadcastCampaigns)
    .leftJoin(
      broadcastRecipients,
      eq(broadcastRecipients.campaignId, broadcastCampaigns.id),
    )
    .where(
      and(
        eq(broadcastCampaigns.organizationId, organizationId),
        sql`${broadcastCampaigns.status} <> 'DRAFT'`,
      ),
    )
    .groupBy(broadcastCampaigns.id)
    .orderBy(desc(broadcastCampaigns.createdAt))
    .limit(3);

  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

export async function getDashboardOverview(
  organizationId: string,
  range: DashboardRange,
): Promise<DashboardOverview> {
  const now = new Date();
  const [leadData, paymentData, conversationData, appointmentData, broadcastData] =
    await Promise.all([
      section("leads", () => leadSection(organizationId, range, now)),
      section("payments", () => paymentSection(organizationId, range, now)),
      section("conversations", () => conversationSection(organizationId)),
      section("appointments", () => appointmentSection(organizationId, now)),
      section("broadcasts", () => broadcastSection(organizationId)),
    ]);

  return {
    range,
    generatedAt: now.toISOString(),
    leads: leadData,
    payments: paymentData,
    conversations: conversationData,
    appointments: appointmentData,
    broadcasts: broadcastData,
  };
}
