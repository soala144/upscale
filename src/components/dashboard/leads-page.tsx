"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Search, Upload, UsersRound } from "lucide-react";

import { AddLeadDialog, ImportLeadsDialog } from "@/components/dashboard/lead-intake-dialogs";
import { Button, EmptyState, InlineNotice, PageHeader, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { getLeads, type Lead } from "@/lib/api/leads";
import { ApiError } from "@/lib/api/client";
import { stageTone } from "@/components/dashboard/overview-page";

const stages: Array<Lead["stage"] | "ALL"> = ["ALL", "NEW", "QUALIFYING", "HOT", "WARM", "COLD", "PAYMENT_PENDING", "CONVERTED"];

export function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stage, setStage] = useState<Lead["stage"] | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setLeads(await getLeads());
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "We couldn't load your leads.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const visibleLeads = useMemo(() => leads.filter((lead) => {
    const text = [lead.name, lead.email, lead.phone, lead.need, lead.source, lead.location].filter(Boolean).join(" ").toLowerCase();
    return (stage === "ALL" || lead.stage === stage) && text.includes(query.trim().toLowerCase());
  }), [leads, query, stage]);

  return (
    <>
      <PageHeader
        title="Leads"
        description="Review qualification signals and decide which prospects need a follow-up."
        actions={<div className="flex gap-2"><Button variant="secondary" onClick={() => setImporting(true)}><Upload className="h-4 w-4" aria-hidden="true" /> Import CSV</Button><Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" aria-hidden="true" /> Add lead</Button></div>}
      />
      <AddLeadDialog open={adding} onClose={() => setAdding(false)} onCreated={() => void load()} />
      <ImportLeadsDialog open={importing} onClose={() => setImporting(false)} onImported={() => void load()} />
      {error ? <div className="mb-5"><InlineNotice>{error}</InlineNotice><button type="button" className="mt-3 text-sm font-semibold text-primary underline" onClick={() => void load()}>Try again</button></div> : null}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search leads</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="min-h-11 w-full rounded-lg border border-border-strong bg-surface pl-9 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, need, location..." />
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted sm:min-w-44">
          <span className="sr-only">Filter by lead stage</span>
          <select className="min-h-11 rounded-lg border border-border-strong bg-surface px-3 text-sm text-foreground" value={stage} onChange={(event) => setStage(event.target.value as Lead["stage"] | "ALL")}>
            {stages.map((item) => <option key={item} value={item}>{item === "ALL" ? "All stages" : item.replaceAll("_", " ")}</option>)}
          </select>
        </label>
      </div>
      {loading ? <div className="grid gap-3">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-24" />)}</div> : error ? null : visibleLeads.length ? (
        <>
          <p className="mb-3 text-xs text-muted">{visibleLeads.length} lead{visibleLeads.length === 1 ? "" : "s"}</p>
          <div className="grid gap-3">
            {visibleLeads.map((lead) => (
              <Link className="surface-card grid gap-4 p-4 transition-colors hover:border-border-strong sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5" href={`/leads/${encodeURIComponent(lead.id)}`} key={lead.id}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate font-semibold">{lead.name || "Unnamed lead"}</h2>
                    <StatusBadge tone={stageTone(lead.stage)}>{lead.stage.replaceAll("_", " ")}</StatusBadge>
                    {lead.urgent ? <StatusBadge tone="danger">Urgent</StatusBadge> : null}
                    {lead.handedOff ? <StatusBadge tone="warning">Human follow-up</StatusBadge> : null}
                  </div>
                  <p className="mt-1 truncate text-sm text-muted">{lead.summary || lead.need || "No qualification summary yet"}</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                    <span>Source: {lead.source || "Unknown"}</span>
                    {lead.budget ? <span>Budget: {lead.budget}</span> : null}
                    {lead.timeline ? <span>Timeline: {lead.timeline}</span> : null}
                    {lead.location ? <span>Location: {lead.location}</span> : null}
                    <span>Updated {new Date(lead.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <div className="text-sm font-semibold">{lead.score}<span className="ml-1 text-xs font-normal text-muted">/ 100</span></div>
                  <span className="text-xs font-semibold text-primary">View details</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <div className="surface-card">
          {leads.length ? <EmptyState title="No matching leads" description="Try changing your search or stage filter." /> : <EmptyState title="No leads yet" description="When customers start conversations with your Telegram bot, qualified leads will appear here." icon={<UsersRound className="h-5 w-5" />} action={<Link href="/integrations" className="text-sm font-semibold text-primary hover:underline">Connect Telegram</Link>} />}
        </div>
      )}
    </>
  );
}
