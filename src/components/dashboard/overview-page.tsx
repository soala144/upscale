"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ArrowRight, CalendarDays, MessageCircle, RefreshCw, Send } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { EmptyState, InlineNotice, PageHeader, SectionCard, SectionError, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { ApiError } from "@/lib/api/client";
import { getDashboardOverview, type DashboardOverview, type DashboardRange } from "@/lib/api/dashboard";
import type { Lead } from "@/lib/api/leads";
import { leadStages } from "@/server/dashboard/metrics";

const ranges: Array<{ value: DashboardRange; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "all", label: "All time" },
];

export function OverviewPage() {
  const [range, setRange] = useState<DashboardRange>("30d");
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (selected: DashboardRange) => {
    setLoading(true);
    setError("");
    try {
      setData(await getDashboardOverview(selected));
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "We couldn't load your overview.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(() => load(range)); }, [load, range]);

  return (
    <>
      <PageHeader
        title="Overview"
        description="Lead, payment and follow-up performance for your organization."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-border-strong bg-surface p-0.5" role="group" aria-label="Date range">
              {ranges.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={range === item.value}
                  onClick={() => setRange(item.value)}
                  className={`min-h-9 rounded-md px-3 text-sm font-medium ${range === item.value ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-sm font-semibold hover:bg-surface-muted"
              type="button"
              onClick={() => void load(range)}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh
            </button>
          </div>
        }
      />
      {error ? (
        <div className="mb-5">
          <InlineNotice>{error}</InlineNotice>
          <button className="mt-3 text-sm font-semibold text-primary underline" onClick={() => void load(range)} type="button">Try again</button>
        </div>
      ) : null}
      {!data && loading ? <OverviewSkeleton /> : data ? <OverviewContent data={data} refreshing={loading} /> : null}
    </>
  );
}

function OverviewSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Loading overview">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-28" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

function OverviewContent({ data, refreshing }: { data: DashboardOverview; refreshing: boolean }) {
  const leads = data.leads.ok ? data.leads.data : null;
  const payments = data.payments.ok ? data.payments.data : null;
  const rangeLabel = ranges.find((item) => item.value === data.range)?.label.toLowerCase() ?? "";
  const cohortNote = data.range === "all" ? "all leads" : `leads created in the last ${rangeLabel}`;

  return (
    <div className={`grid gap-4 ${refreshing ? "opacity-70" : ""}`} aria-busy={refreshing}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Leads"
          failed={!data.leads.ok}
          value={leads ? leads.total.toLocaleString() : ""}
          hint={cohortNote}
        />
        <MetricCard
          label="Qualification rate"
          failed={!data.leads.ok}
          value={leads ? formatPercent(leads.qualificationRate) : ""}
          hint={leads ? `${leads.qualified.toLocaleString()} of ${leads.total.toLocaleString()} reached HOT, WARM, payment or converted` : ""}
        />
        <MetricCard
          label="Conversion rate"
          failed={!data.leads.ok}
          value={leads ? formatPercent(leads.conversionRate) : ""}
          hint={leads ? `${leads.converted.toLocaleString()} of ${leads.total.toLocaleString()} leads converted` : ""}
        />
        <MetricCard
          label="Revenue"
          failed={!data.payments.ok}
          value={payments ? formatMoneyTotals(payments.revenue) : ""}
          hint={payments ? `${payments.paidCount.toLocaleString()} confirmed payment${payments.paidCount === 1 ? "" : "s"}${payments.pendingCount ? ` · ${formatMoneyTotals(payments.pendingAmount)} pending (not counted)` : ""}` : ""}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="New leads" description={data.range === "all" ? "Created per day, last 90 days" : "Created per day"}>
          {data.leads.ok ? (
            data.leads.data.trend.some((point) => point.count > 0) ? (
              <div className="h-64 px-2 pb-3 pt-4" role="img" aria-label="Bar chart of new leads per day">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.leads.data.trend} margin={{ left: 0, right: 12, top: 4, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} minTickGap={24} />
                    <YAxis allowDecimals={false} width={32} tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} />
                    <Tooltip cursor={{ fill: "var(--surface-muted)" }} labelFormatter={(label) => shortDate(String(label))} formatter={(value) => [value, "Leads"]} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }} />
                    <Bar dataKey="count" fill="var(--primary)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState title="No new leads in this period" description="Leads appear as customers start conversations with your connected channels." action={<Link className="text-sm font-semibold text-primary hover:underline" href="/integrations">Manage integrations</Link>} />
            )
          ) : <SectionError label="lead activity" />}
        </SectionCard>

        <SectionCard title="Pipeline" description="Current stage of these leads">
          {data.leads.ok ? (
            data.leads.data.total > 0 ? (
              <ul className="grid gap-3 p-5">
                {leadStages.map((stage) => {
                  const count = data.leads.ok ? data.leads.data.stages[stage] : 0;
                  const share = data.leads.ok && data.leads.data.total ? (count / data.leads.data.total) * 100 : 0;
                  return (
                    <li key={stage}>
                      <div className="flex items-baseline justify-between text-sm">
                        <span>{stage.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</span>
                        <span className="font-semibold tabular-nums">{count.toLocaleString()}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : <EmptyState title="No leads yet" description="Pipeline stages fill in as leads are qualified." />
          ) : <SectionError label="the pipeline" />}
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Recent conversations" action={<ViewAll href="/leads" label="All leads" />}>
          {data.conversations.ok ? (
            data.conversations.data.length ? (
              <ul className="divide-y divide-border">
                {data.conversations.data.map((item) => (
                  <li key={item.id}>
                    <Link className="flex min-h-16 items-center justify-between gap-4 px-5 py-3 hover:bg-surface-muted" href={`/leads/${encodeURIComponent(item.leadId)}`}>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{item.leadName || "Unnamed lead"}</p>
                        <p className="mt-0.5 truncate text-xs text-muted">{item.lastMessage ?? "No messages yet"}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <StatusBadge tone={stageTone(item.stage as Lead["stage"])}>{item.stage.replaceAll("_", " ")}</StatusBadge>
                        <time className="text-[11px] text-muted" dateTime={item.updatedAt}>{relativeTime(item.updatedAt)}</time>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon={<MessageCircle className="h-5 w-5" />} title="No conversations yet" description="Conversations appear after a customer messages your Telegram bot." action={<Link className="text-sm font-semibold text-primary hover:underline" href="/integrations">Connect Telegram</Link>} />
          ) : <SectionError label="conversations" />}
        </SectionCard>

        <SectionCard title="Upcoming appointments" action={<ViewAll href="/calendar" label="Calendar" />}>
          {data.appointments.ok ? (
            data.appointments.data.length ? (
              <ul className="divide-y divide-border">
                {data.appointments.data.map((item) => (
                  <li key={item.id}>
                    <Link className="flex min-h-16 items-center justify-between gap-4 px-5 py-3 hover:bg-surface-muted" href={`/calendar?appointment=${encodeURIComponent(item.id)}`}>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{item.title}</p>
                        <p className="mt-0.5 truncate text-xs text-muted">{item.leadName ?? "No lead linked"}</p>
                      </div>
                      <time className="shrink-0 text-right text-xs text-muted" dateTime={item.startsAt}>
                        <span className="block font-semibold text-foreground">{new Date(item.startsAt).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</span>
                        {new Date(item.startsAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      </time>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon={<CalendarDays className="h-5 w-5" />} title="Nothing scheduled" description="Book an appointment from a qualified lead or from the calendar." action={<Link className="text-sm font-semibold text-primary hover:underline" href="/calendar">Open calendar</Link>} />
          ) : <SectionError label="appointments" />}
        </SectionCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Recent broadcasts" action={<ViewAll href="/broadcast" label="Broadcast" />}>
          {data.broadcasts.ok ? (
            data.broadcasts.data.length ? (
              <ul className="divide-y divide-border">
                {data.broadcasts.data.map((item) => (
                  <li key={item.id}>
                    <Link className="flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3 hover:bg-surface-muted" href={`/broadcast/${encodeURIComponent(item.id)}`}>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{item.name}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {item.sent.toLocaleString()} sent · {item.failed.toLocaleString()} failed · {item.skipped.toLocaleString()} skipped of {item.recipients.toLocaleString()}
                        </p>
                      </div>
                      <CampaignStatusBadge status={item.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon={<Send className="h-5 w-5" />} title="No broadcasts sent" description="Follow up with existing leads from the Broadcast page." action={<Link className="text-sm font-semibold text-primary hover:underline" href="/broadcast/new">New broadcast</Link>} />
          ) : <SectionError label="broadcasts" />}
        </SectionCard>

        <SectionCard title="Lead sources">
          {data.leads.ok ? (
            data.leads.data.sources.length ? (
              <ul className="grid gap-2 p-5">
                {data.leads.data.sources.map((item) => (
                  <li key={item.source} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{item.source.toLowerCase()}</span>
                    <span className="font-semibold tabular-nums">{item.count.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            ) : <EmptyState title="No sources yet" description="Sources appear once leads arrive." />
          ) : <SectionError label="lead sources" />}
        </SectionCard>
      </div>
    </div>
  );
}

function ViewAll({ href, label }: { href: string; label: string }) {
  return <Link className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-primary hover:underline" href={href}>{label} <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>;
}

export function CampaignStatusBadge({ status }: { status: string }) {
  const tone = status === "COMPLETED" ? "success" : status === "PROCESSING" ? "info" : status === "PARTIALLY_FAILED" ? "warning" : status === "FAILED" ? "danger" : "neutral";
  return <StatusBadge tone={tone}>{status.replaceAll("_", " ")}</StatusBadge>;
}

export function MetricCard({ label, value, hint, failed = false, icon }: { label: string; value: string; hint?: string; failed?: boolean; icon?: ReactNode }) {
  return (
    <article className="surface-card p-4">
      <div className="flex items-center justify-between gap-4 text-xs font-medium text-muted"><span>{label}</span>{icon}</div>
      {failed ? (
        <p className="mt-3 text-sm font-semibold text-danger" role="alert">Couldn&apos;t load</p>
      ) : (
        <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      )}
      {hint && !failed ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </article>
  );
}

function formatPercent(value: number | null) {
  return value === null ? "—" : `${value}%`;
}

function formatMoneyTotals(totals: Array<{ currency: string; amount: string }>) {
  if (!totals.length) return formatMoney(0, "NGN");
  return totals.map((total) => formatMoney(Number(total.amount), total.currency)).join(" + ");
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

export function formatNaira(value: number) {
  return formatMoney(value, "NGN");
}

function shortDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

function relativeTime(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1_440) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / 1_440)}d ago`;
}

export function stageTone(stage: Lead["stage"]): "success" | "warning" | "danger" | "info" | "neutral" {
  if (stage === "CONVERTED" || stage === "HOT") return "success";
  if (stage === "PAYMENT_PENDING" || stage === "QUALIFYING") return "warning";
  if (stage === "COLD") return "neutral";
  if (stage === "WARM") return "info";
  return "neutral";
}
