"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CreditCard, RefreshCw, UsersRound } from "lucide-react";

import { EmptyState, InlineNotice, PageHeader, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { getLeads, type Lead } from "@/lib/api/leads";
import { ApiError } from "@/lib/api/client";
import { getPayments, type Payment } from "@/lib/api/payments";

export function OverviewPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [leadItems, paymentItems] = await Promise.all([getLeads(), getPayments()]);
      setLeads(leadItems);
      setPayments(paymentItems);
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "We couldn't load your overview.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const paid = payments.filter((payment) => payment.status === "PAID" && payment.type === "CUSTOMER_PURCHASE");
  const revenue = paid.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const conversionRate = leads.length ? Math.round((leads.filter((lead) => lead.stage === "CONVERTED").length / leads.length) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Overview"
        description="Recent organization activity. Counts reflect up to 200 leads and 100 payments returned by the API."
        actions={<button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-sm font-semibold hover:bg-surface-muted" type="button" onClick={() => void load()} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh</button>}
      />
      {error ? <div className="mb-5"><InlineNotice>{error}</InlineNotice><button className="mt-3 text-sm font-semibold text-primary underline" onClick={() => void load()} type="button">Try again</button></div> : null}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-28" />)}
          <Skeleton className="h-80 sm:col-span-2 xl:col-span-3" />
        </div>
      ) : error ? null : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <MetricCard label="Leads in recent records" value={leads.length.toLocaleString()} icon={<UsersRound className="h-4 w-4" />} />
            <MetricCard label="HOT leads" value={leads.filter((lead) => lead.stage === "HOT").length.toLocaleString()} />
            <MetricCard label="Recent lead conversion" value={`${conversionRate}%`} />
            <MetricCard label="Converted leads" value={leads.filter((lead) => lead.stage === "CONVERTED").length.toLocaleString()} />
            <MetricCard label="Pending customer payments" value={payments.filter((payment) => payment.type === "CUSTOMER_PURCHASE" && payment.status === "PENDING").length.toLocaleString()} icon={<CreditCard className="h-4 w-4" />} />
            <MetricCard label="Revenue in recent payments" value={formatNaira(revenue)} />
          </div>
          <section className="mt-6 surface-card">
            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
              <div><h2 className="font-semibold">Recent leads</h2><p className="mt-1 text-xs text-muted">Latest activity in your organization</p></div>
              <Link className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-primary hover:underline" href="/leads">All leads <ArrowRight className="h-4 w-4" /></Link>
            </div>
            {leads.length ? (
              <div className="divide-y divide-border">
                {leads.slice(0, 6).map((lead) => <Link className="flex min-h-16 items-center justify-between gap-4 px-5 py-3 hover:bg-surface-muted" href={`/leads/${encodeURIComponent(lead.id)}`} key={lead.id}>
                  <div className="min-w-0"><p className="truncate text-sm font-semibold">{lead.name || "Unnamed lead"}</p><p className="mt-1 truncate text-xs text-muted">{lead.need || lead.source || "New conversation"}</p></div>
                  <div className="flex shrink-0 items-center gap-3"><span className="text-sm font-semibold">{lead.score}<span className="ml-1 text-xs font-normal text-muted">/100</span></span><StatusBadge tone={stageTone(lead.stage)}>{lead.stage.replaceAll("_", " ")}</StatusBadge></div>
                </Link>)}
              </div>
            ) : (
              <EmptyState title="No leads yet" description="When customers start conversations with your Telegram bot, leads will appear here." action={<Link className="text-sm font-semibold text-primary hover:underline" href="/integrations">Connect Telegram</Link>} />
            )}
          </section>
        </>
      )}
    </>
  );
}

export function MetricCard({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return <article className="surface-card p-4"><div className="flex items-center justify-between gap-4 text-xs font-medium text-muted"><span>{label}</span>{icon}</div><p className="mt-3 text-2xl font-semibold tracking-tight">{value}</p></article>;
}

export function formatNaira(value: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(value);
}

export function stageTone(stage: Lead["stage"]): "success" | "warning" | "danger" | "info" | "neutral" {
  if (stage === "CONVERTED" || stage === "HOT") return "success";
  if (stage === "PAYMENT_PENDING" || stage === "QUALIFYING") return "warning";
  if (stage === "COLD") return "neutral";
  if (stage === "WARM") return "info";
  return "neutral";
}
