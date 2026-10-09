import type { Subscription } from "@/lib/api/billing";

const DAY = 86_400_000;

/** Where an organization is in its trial or paid period, for progress bars. */
export function planProgress(subscription: Subscription, now = Date.now()) {
  const isTrial = subscription.status === "TRIALING";
  const start = Date.parse((isTrial ? subscription.trialStart : subscription.currentPeriodStart) ?? "");
  const end = Date.parse((isTrial ? subscription.trialEnd : subscription.currentPeriodEnd) ?? "");
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  const elapsed = Math.min(Math.max(now - start, 0), end - start);
  return {
    isTrial,
    percent: Math.round((elapsed / (end - start)) * 100),
    daysLeft: Math.max(Math.ceil((end - now) / DAY), 0),
    totalDays: Math.round((end - start) / DAY),
    endsAt: new Date(end),
  };
}
