"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ExternalLink, MessageCircle, RefreshCw } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { Button, EmptyState, InlineNotice, PageHeader, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { formatNaira, stageTone } from "@/components/dashboard/overview-page";
import { ApiError } from "@/lib/api/client";
import { getLead, getLeadConversation, type Conversation, type Lead } from "@/lib/api/leads";
import { createCustomerCheckout, getPayments, type Payment } from "@/lib/api/payments";
import { paymentFormSchema } from "@/lib/validation/forms";

type PaymentValues = z.input<typeof paymentFormSchema>;
type ValidPaymentValues = z.output<typeof paymentFormSchema>;

export function LeadDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [lead, setLead] = useState<Lead | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [confirmAmount, setConfirmAmount] = useState<number | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const paymentForm = useForm<PaymentValues, unknown, ValidPaymentValues>({
    resolver: zodResolver(paymentFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { amount: "" },
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [leadResult, conversationResult, paymentResult] = await Promise.all([
        getLead(id),
        getLeadConversation(id).catch((reason: unknown) => {
          if (reason instanceof ApiError && reason.status === 404) return null;
          throw reason;
        }),
        getPayments(),
      ]);
      setLead(leadResult);
      setConversation(conversationResult);
      setPayments(paymentResult.filter((payment) => payment.leadId === id));
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "We couldn't load this lead.");
    } finally {
      setLoading(false);
    }
  }, [id]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function requestPayment(values: ValidPaymentValues) {
    if (!lead) return;
    setConfirmAmount(values.amount);
  }

  async function createCheckout() {
    if (!lead || confirmAmount === null || submitting) return;
    setSubmitting(true);
    setError("");
    setCheckoutMessage("");
    try {
      const checkout = await createCustomerCheckout({ leadId: lead.id, amount: confirmAmount });
      setCheckoutUrl(checkout.checkoutUrl);
      setCheckoutMessage(`Checkout created for ${formatNaira(Number(checkout.amount))}. Payment remains pending until Bachs confirms it.`);
      setConfirmAmount(null);
      paymentForm.reset({ amount: "" });
      await load();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "We couldn't create the checkout.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="grid gap-4"><Skeleton className="h-10 w-48" /><Skeleton className="h-52" /><Skeleton className="h-72" /></div>;
  if (error && !lead) return <><InlineNotice>{error}</InlineNotice><button className="mt-3 text-sm font-semibold text-primary underline" type="button" onClick={() => void load()}>Try again</button></>;
  if (!lead) return null;

  const customerPayments = payments.filter((payment) => payment.type === "CUSTOMER_PURCHASE");
  const paid = customerPayments.find((payment) => payment.status === "PAID");
  const pending = customerPayments.find((payment) => payment.status === "PENDING");

  return (
    <>
      <Link href="/leads" className="mb-5 inline-flex min-h-9 items-center gap-2 text-sm font-medium text-muted hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to leads</Link>
      <PageHeader
        title={lead.name || "Unnamed lead"}
        description={lead.email || lead.phone || `Added ${new Date(lead.createdAt).toLocaleDateString()}`}
        actions={<div className="flex items-center gap-2"><StatusBadge tone={stageTone(lead.stage)}>{lead.stage.replaceAll("_", " ")}</StatusBadge><button type="button" disabled={loading} onClick={() => void load()} aria-label="Refresh lead and payment status" className="grid h-10 w-10 place-items-center rounded-lg border border-border-strong bg-surface hover:bg-surface-muted"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button></div>}
      />
      {error ? <div className="mb-4"><InlineNotice>{error}</InlineNotice></div> : null}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <div className="grid min-w-0 gap-4">
          <section className="surface-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-semibold uppercase tracking-wider text-muted">Lead score</p><p className="mt-2 text-4xl font-semibold tracking-tight">{lead.score}<span className="ml-1 text-base font-normal text-muted">/ 100</span></p></div>
              <div className="grid gap-2 text-right">
                {lead.urgent ? <StatusBadge tone="danger">Urgent</StatusBadge> : null}
                {lead.handedOff ? <StatusBadge tone="warning">Human follow-up</StatusBadge> : null}
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-label="Lead score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={lead.score}>
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, lead.score))}%` }} />
            </div>
            {lead.summary ? <p className="mt-4 text-sm leading-6 text-muted">{lead.summary}</p> : null}
          </section>
          <section className="surface-card p-5">
            <h2 className="font-semibold">Qualification</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <DetailItem label="Need" value={lead.need} />
              <DetailItem label="Product or service" value={lead.propertyType} />
              <DetailItem label="Location" value={lead.location} />
              <DetailItem label="Budget" value={lead.budget} />
              <DetailItem label="Timeline" value={lead.timeline} />
              <DetailItem label="Decision maker" value={lead.decisionMaker === null ? null : lead.decisionMaker ? "Yes" : "No"} />
              <DetailItem label="Source" value={lead.source} />
              <DetailItem label="Last activity" value={new Date(lead.updatedAt).toLocaleString()} />
            </dl>
          </section>
          <section className="surface-card overflow-hidden">
            <div className="border-b border-border px-5 py-4"><h2 className="font-semibold">Conversation</h2><p className="mt-1 text-xs text-muted">{conversation ? `${conversation.channel} · ${conversation.status.toLowerCase()}` : "No conversation recorded"}</p></div>
            {conversation?.messages.length ? <ol className="grid gap-4 p-5">
              {conversation.messages.map((message) => {
                const author = message.role === "USER" ? "Customer" : message.role === "ASSISTANT" ? "AI" : message.role === "HUMAN" ? "Human" : "System";
                return <li key={message.id} className={`flex ${message.role === "ASSISTANT" ? "justify-end" : ""}`}>
                  <article className={`max-w-[90%] rounded-xl border px-4 py-3 ${message.role === "ASSISTANT" ? "border-primary/20 bg-success-foreground" : message.role === "SYSTEM" ? "border-border bg-surface-muted" : "border-border bg-surface"}`}>
                    <div className="mb-1 flex items-center justify-between gap-6"><span className="text-xs font-semibold">{author}</span><time className="text-[11px] text-muted" dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time></div>
                    <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.content}</p>
                  </article>
                </li>;
              })}
            </ol> : <EmptyState title="No messages yet" description="Messages for this lead will appear here after the customer starts a conversation." icon={<MessageCircle className="h-5 w-5" />} />}
          </section>
        </div>
        <aside className="grid content-start gap-4">
          <section className="surface-card p-5">
            <h2 className="font-semibold">Payment</h2>
            {paid ? (
              <div className="mt-4"><StatusBadge tone="success">PAID</StatusBadge><p className="mt-3 text-xl font-semibold">{formatNaira(Number(paid.amount))}</p><p className="mt-1 text-xs text-muted">Confirmed by Bachs</p></div>
            ) : pending ? (
              <div className="mt-4"><StatusBadge tone="warning">PENDING</StatusBadge><p className="mt-3 text-xl font-semibold">{formatNaira(Number(pending.amount))}</p><p className="mt-1 text-xs text-muted">Waiting for provider confirmation.</p></div>
            ) : (
              <form className="mt-4 grid gap-3" onSubmit={paymentForm.handleSubmit(requestPayment)} noValidate>
                <label className="grid gap-1.5 text-sm font-medium" htmlFor="payment-amount">Amount (NGN)
                  <input id="payment-amount" type="number" inputMode="decimal" min="0.01" step="0.01" required aria-invalid={Boolean(paymentForm.formState.errors.amount)} aria-describedby={paymentForm.formState.errors.amount ? "payment-amount-error" : undefined} {...paymentForm.register("amount")} className={`min-h-11 rounded-lg border bg-surface px-3 ${paymentForm.formState.errors.amount ? "border-danger" : "border-border-strong"}`} placeholder="250000" />
                </label>
                {paymentForm.formState.errors.amount?.message ? <p id="payment-amount-error" className="-mt-2 text-xs text-danger" role="alert">{paymentForm.formState.errors.amount.message}</p> : null}
                {confirmAmount === null ? <Button type="submit" disabled={submitting || lead.stage === "CONVERTED"}>Request payment</Button> : (
                  <div className="rounded-lg border border-border bg-surface-muted p-4" aria-live="polite">
                    <h3 className="font-semibold">Confirm checkout request</h3>
                    <dl className="mt-3 grid gap-2 text-sm">
                      <div className="flex justify-between gap-3"><dt className="text-muted">Amount</dt><dd className="font-semibold">{formatNaira(confirmAmount)}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-muted">Payment type</dt><dd>Customer payment</dd></div>
                    </dl>
                    <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                      <Button type="button" variant="secondary" disabled={submitting} onClick={() => setConfirmAmount(null)}>Cancel</Button>
                      <Button type="button" disabled={submitting} onClick={() => void createCheckout()}>{submitting ? "Creating checkout..." : "Create checkout"}</Button>
                    </div>
                  </div>
                )}
                <p className="text-xs leading-5 text-muted">The customer payment will use your organization&apos;s connected Bachs account.</p>
              </form>
            )}
            {checkoutMessage ? <div className="mt-4"><StatusBadge tone="warning">Payment pending</StatusBadge><p className="mt-2 text-sm">{checkoutMessage}</p></div> : null}
            {checkoutUrl ? <a className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-primary hover:underline" href={checkoutUrl} target="_blank" rel="noreferrer">Open checkout <ExternalLink className="h-4 w-4" /></a> : null}
            {customerPayments.length ? <div className="mt-5 border-t border-border pt-4"><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Payment history</p><ul className="grid gap-2">{customerPayments.map((payment) => <li key={payment.id} className="flex items-center justify-between gap-2 text-sm"><span>{formatNaira(Number(payment.amount))}</span><StatusBadge tone={payment.status === "PAID" ? "success" : payment.status === "PENDING" ? "warning" : "danger"}>{payment.status}</StatusBadge></li>)}</ul></div> : null}
          </section>
        </aside>
      </div>
    </>
  );
}

function DetailItem({ label, value }: { label: string; value: string | null }) {
  return <div><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{value || "Not provided"}</dd></div>;
}
