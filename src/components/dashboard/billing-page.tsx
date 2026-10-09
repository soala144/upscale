"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CreditCard, LoaderCircle } from "lucide-react";

import { formatNaira } from "@/components/dashboard/overview-page";
import { Button, InlineNotice, PageHeader, SectionCard, Skeleton, StatusBadge } from "@/components/ui/primitives";
import { ApiError } from "@/lib/api/client";
import { createSubscriptionCheckout, getSubscription, type Subscription } from "@/lib/api/billing";
import { getPayments, type Payment } from "@/lib/api/payments";
import { planProgress } from "@/lib/plan-progress";
import { subscriptionPlans, trialDurationDays, type SubscriptionPlan } from "@/lib/plans";

const planOrder: SubscriptionPlan[] = ["BASIC", "GROWTH", "SCALE"];

const msg = (reason: unknown, fallback: string) =>
  reason instanceof ApiError ? (reason.serverMessage ?? reason.message) : fallback;

export function BillingPage() {
  const params = useSearchParams();
  const returned = params.get("checkout");
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState<SubscriptionPlan | null>(null);
  const [waiting, setWaiting] = useState(returned === "return");
  const polls = useRef(0);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [sub, pay] = await Promise.all([getSubscription(), getPayments().catch(() => [] as Payment[])]);
      setSubscription(sub.subscription);
      setPayments(pay.filter((payment) => payment.type === "SUBSCRIPTION"));
      setError("");
      return sub.subscription;
    } catch (reason) {
      setError(msg(reason, "We couldn't load your billing details."));
      return null;
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(() => load()); }, [load]);

  // After returning from checkout the provider webhook confirms payment; poll briefly for it.
  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(async () => {
      polls.current += 1;
      const latest = await load(true);
      if (latest?.status === "ACTIVE" || polls.current >= 24) setWaiting(false);
    }, 5_000);
    return () => clearInterval(timer);
  }, [waiting, load]);

  async function pay(plan: SubscriptionPlan) {
    if (paying) return;
    setPaying(plan);
    setError("");
    try {
      const checkout = await createSubscriptionCheckout(plan);
      window.location.assign(checkout.checkoutUrl);
    } catch (reason) {
      setError(msg(reason, "We couldn't start the payment. Please try again."));
      setPaying(null);
    }
  }

  const progress = subscription ? planProgress(subscription) : null;
  const current = subscription?.plan as SubscriptionPlan | undefined;
  const active = subscription?.status === "ACTIVE";

  return (
    <>
      <PageHeader title="Billing" description="Your plan, how much time is left, and how to upgrade or renew." />
      {error ? <div className="mb-4"><InlineNotice>{error}</InlineNotice></div> : null}
      {returned === "return" ? (
        <div className="mb-4">
          <InlineNotice tone={active ? "success" : "info"}>
            {active ? "Payment confirmed. Your plan is active." : waiting ? "Thanks. We are waiting for Bachs to confirm your payment, this usually takes under a minute." : "We have not received confirmation yet. If you completed the payment, refresh in a few minutes."}
          </InlineNotice>
        </div>
      ) : null}
      {returned === "cancelled" ? <div className="mb-4"><InlineNotice tone="info">Payment cancelled. You have not been charged.</InlineNotice></div> : null}

      {loading ? <div className="grid gap-4"><Skeleton className="h-44" /><Skeleton className="h-64" /></div> : subscription ? (
        <div className="grid gap-5">
          <section className="surface-card p-5 sm:p-6" aria-label="Current plan">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Current plan</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight">{subscriptionPlans[current ?? "BASIC"].name}</p>
                <p className="mt-1 text-sm text-muted">{formatNaira(Number(subscription.amount))} per month</p>
              </div>
              <StatusBadge tone={subscription.status === "ACTIVE" ? "success" : subscription.status === "TRIALING" ? "info" : "danger"}>
                {subscription.status === "TRIALING" ? "Free trial" : subscription.status === "ACTIVE" ? "Active" : subscription.status.replaceAll("_", " ")}
              </StatusBadge>
            </div>

            {progress ? (
              <div className="mt-6">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{progress.isTrial ? "Free trial" : "Current billing period"}</span>
                  <span className="text-muted">
                    {progress.daysLeft === 0 ? "Ends today" : `${progress.daysLeft} day${progress.daysLeft === 1 ? "" : "s"} left`} of {progress.totalDays || trialDurationDays}
                  </span>
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-surface-muted" role="progressbar" aria-label={progress.isTrial ? "Trial progress" : "Billing period progress"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percent}>
                  <div className={`h-full rounded-full ${progress.daysLeft <= 3 ? "bg-warning" : "bg-primary"}`} style={{ width: `${progress.percent}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted">
                  {progress.isTrial ? "Trial ends" : active ? "Renews or expires" : "Period ended"} on {progress.endsAt.toLocaleDateString(undefined, { dateStyle: "long" })}
                  {subscription.nextPaymentDue && active ? `. Next payment due ${new Date(subscription.nextPaymentDue).toLocaleDateString(undefined, { dateStyle: "long" })}.` : "."}
                </p>
              </div>
            ) : null}
            {subscription.status === "PAST_DUE" || subscription.status === "EXPIRED" ? (
              <div className="mt-4"><InlineNotice>Your plan has lapsed. Choose a plan below to keep the assistant replying.</InlineNotice></div>
            ) : null}
          </section>

          <SectionCard title="Choose a plan" description="Payments are one month at a time and are confirmed by Bachs. Paying early on a trial adds a month of paid time.">
            <div className="grid gap-4 p-5 md:grid-cols-3">
              {planOrder.map((id) => {
                const plan = subscriptionPlans[id];
                const isCurrent = current === id && active;
                return (
                  <article key={id} className={`flex flex-col rounded-xl border p-5 ${id === current ? "border-primary bg-success-foreground" : "border-border"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold">{plan.name}</h3>
                      {"recommended" in plan && plan.recommended ? <StatusBadge tone="success">Popular</StatusBadge> : null}
                    </div>
                    <p className="mt-3 text-3xl font-semibold tracking-tight">{formatNaira(plan.monthlyAmount)}<span className="text-sm font-normal text-muted"> /month</span></p>
                    <p className="mt-2 flex-1 text-sm text-muted">{plan.description}</p>
                    <Button className="mt-5" variant={id === current ? "primary" : "secondary"} disabled={Boolean(paying)} onClick={() => void pay(id)}>
                      {paying === id ? <><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Opening Bachs...</> : isCurrent ? <><Check className="h-4 w-4" aria-hidden="true" /> Renew {plan.name}</> : <><CreditCard className="h-4 w-4" aria-hidden="true" /> Pay {formatNaira(plan.monthlyAmount)}</>}
                    </Button>
                  </article>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Payment history">
            {payments.length ? (
              <ul className="divide-y divide-border">
                {payments.map((payment) => (
                  <li key={payment.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div><p className="font-semibold">{formatNaira(Number(payment.amount))}</p><p className="text-xs text-muted">{new Date(payment.createdAt).toLocaleString()}</p></div>
                    <StatusBadge tone={payment.status === "PAID" ? "success" : payment.status === "PENDING" ? "warning" : "danger"}>{payment.status}</StatusBadge>
                  </li>
                ))}
              </ul>
            ) : <p className="px-5 py-8 text-center text-sm text-muted">No subscription payments yet.</p>}
          </SectionCard>
        </div>
      ) : null}
    </>
  );
}
