"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { CampaignStatusBadge, MetricCard } from "@/components/dashboard/overview-page";
import { Button, InlineNotice, PageHeader, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { ApiError } from "@/lib/api/client";
import { cancelCampaign, getCampaign, nudgeCampaign } from "@/lib/api/broadcast";
import { describeRecipientOutcome } from "@/lib/broadcast/labels";

type Detail = Awaited<ReturnType<typeof getCampaign>>;

export function BroadcastDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const lastProcessed = useRef(-1);
  const stalls = useRef(0);

  const load = useCallback(async () => {
    try {
      const result = await getCampaign(id, page);
      setDetail(result);
      setError("");
      if (result.campaign.status === "PROCESSING") {
        const processed = result.counts.sent + result.counts.failed + result.counts.skipped;
        stalls.current = processed === lastProcessed.current ? stalls.current + 1 : 0;
        lastProcessed.current = processed;
        // No progress for a few polls: ask the server to resume delivery.
        if (stalls.current >= 3) { stalls.current = 0; void nudgeCampaign(id).catch(() => undefined); }
      }
    } catch (reason) {
      setError(reason instanceof ApiError ? (reason.serverMessage ?? reason.message) : "We couldn't load this campaign.");
    }
  }, [id, page]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const processing = detail?.campaign.status === "PROCESSING";
  useEffect(() => {
    if (!processing) return;
    const timer = setInterval(() => void load(), 4_000);
    return () => clearInterval(timer);
  }, [processing, load]);

  async function cancel() {
    if (!window.confirm("Cancel this campaign? Messages not yet sent will be skipped.")) return;
    setBusy(true);
    try { await cancelCampaign(id); await load(); }
    catch (reason) { setError(reason instanceof ApiError ? (reason.serverMessage ?? reason.message) : "We couldn't cancel."); }
    finally { setBusy(false); }
  }

  if (!detail) return error ? <InlineNotice>{error}</InlineNotice> : <div className="grid gap-4"><Skeleton className="h-20" /><Skeleton className="h-64" /></div>;

  const { campaign, counts, recipients } = detail;
  const processed = counts.sent + counts.failed + counts.skipped;
  const pct = counts.total ? Math.round((processed / counts.total) * 100) : 0;
  const pages = Math.max(1, Math.ceil(counts.total / detail.pageSize));

  return (
    <>
      <Link href="/broadcast" className="mb-5 inline-flex min-h-9 items-center gap-2 text-sm font-medium text-muted hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to broadcasts</Link>
      <PageHeader
        title={campaign.name}
        description={`Telegram · created ${new Date(campaign.createdAt).toLocaleString()}`}
        actions={<div className="flex items-center gap-2"><CampaignStatusBadge status={campaign.status} />{["DRAFT", "PROCESSING"].includes(campaign.status) ? <Button variant="secondary" disabled={busy} onClick={() => void cancel()}>Cancel campaign</Button> : null}</div>}
      />
      {error ? <div className="mb-4"><InlineNotice>{error}</InlineNotice></div> : null}
      {campaign.status === "DRAFT" ? <div className="mb-4"><InlineNotice tone="info">This campaign was saved but never sent.</InlineNotice></div> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Selected" value={counts.total.toLocaleString()} />
        <MetricCard label="Processed" value={`${processed.toLocaleString()}`} hint={`${pct}% of selected`} />
        <MetricCard label="Sent" value={counts.sent.toLocaleString()} hint="Accepted by Telegram" />
        <MetricCard label="Failed" value={counts.failed.toLocaleString()} />
        <MetricCard label="Skipped" value={counts.skipped.toLocaleString()} hint="Opted out or ineligible" />
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-label="Campaign progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
      <p className="mt-2 text-xs text-muted">Telegram does not report delivery or read receipts for bot messages, so &quot;sent&quot; means Telegram accepted the message.</p>

      <section className="surface-card mt-4 p-5">
        <h2 className="font-semibold">Message</h2>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted">{campaign.body}</p>
      </section>

      <section className="surface-card mt-4 overflow-hidden">
        <div className="border-b border-border px-5 py-4"><h2 className="font-semibold">Recipients</h2></div>
        {recipients.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-surface-muted text-xs text-muted"><tr><th scope="col" className="px-5 py-2 font-medium">Contact</th><th scope="col" className="px-5 py-2 font-medium">Status</th><th scope="col" className="px-5 py-2 font-medium">Detail</th></tr></thead>
              <tbody className="divide-y divide-border">
                {recipients.map((r) => (
                  <tr key={r.id}>
                    <td className="px-5 py-3">{r.leadId ? <Link className="font-medium text-primary hover:underline" href={`/leads/${encodeURIComponent(r.leadId)}`}>{r.name || "Unnamed lead"}</Link> : (r.name || "Deleted lead")}</td>
                    <td className="px-5 py-3"><StatusBadge tone={r.status === "SENT" ? "success" : r.status === "FAILED" ? "danger" : r.status === "SKIPPED" ? "neutral" : "info"}>{r.status}</StatusBadge></td>
                    <td className="px-5 py-3 text-xs text-muted">{describeRecipientOutcome(r.skipReason, r.errorCode) ?? (r.sentAt ? new Date(r.sentAt).toLocaleString() : "")}{r.attempts > 1 ? ` · ${r.attempts} attempts` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="px-5 py-8 text-center text-sm text-muted">No recipients recorded.</p>}
        {pages > 1 ? <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm"><Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button><span className="text-muted">Page {page} of {pages}</span><Button variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button></div> : null}
      </section>
    </>
  );
}
