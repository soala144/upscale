"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";

import { EmptyState, InlineNotice, PageHeader, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { formatNaira } from "@/components/dashboard/overview-page";
import { ApiError } from "@/lib/api/client";
import { getPayments, type Payment } from "@/lib/api/payments";

export function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setPayments(await getPayments()); }
    catch (reason) { setError(reason instanceof ApiError ? reason.message : "We couldn't load payments."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  return (
    <>
      <PageHeader title="Payments" description="Payment status is confirmed by the provider webhook, not by checkout redirects." actions={<button type="button" disabled={loading} onClick={() => void load()} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border-strong bg-surface px-3 text-sm font-semibold hover:bg-surface-muted"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh status</button>} />
      {error ? <div className="mb-5"><InlineNotice>{error}</InlineNotice><button type="button" className="mt-3 text-sm font-semibold text-primary underline" onClick={() => void load()}>Try again</button></div> : null}
      {loading ? <div className="grid gap-3">{Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-20" />)}</div> : error ? null : payments.length ? (
        <div className="grid gap-3">
          {payments.map((payment) => (
            <article className="surface-card grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:p-5" key={payment.id}>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{payment.type === "CUSTOMER_PURCHASE" ? "Customer payment" : "Subscription payment"}</p>
                <p className="mt-1 truncate text-xs text-muted">Reference {payment.providerReference || payment.id}</p>
                <p className="mt-1 text-xs text-muted">{new Date(payment.updatedAt).toLocaleString()}</p>
              </div>
              <div className="flex items-center justify-between gap-4 sm:block sm:text-right">
                <p className="font-semibold">{formatNaira(Number(payment.amount))}</p>
                <p className="text-xs text-muted">{payment.currency}</p>
              </div>
              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <StatusBadge tone={payment.status === "PAID" ? "success" : payment.status === "PENDING" ? "warning" : "danger"}>{payment.status}</StatusBadge>
                {payment.leadId ? <Link className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline" href={`/leads/${encodeURIComponent(payment.leadId)}`}>Lead <ExternalLink className="h-3 w-3" /></Link> : null}
              </div>
            </article>
          ))}
        </div>
      ) : <div className="surface-card"><EmptyState title="No payments yet" description="Customer checkouts and subscription payments will appear here after they are created." /></div>}
    </>
  );
}
