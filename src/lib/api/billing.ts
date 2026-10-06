import { apiRequest, jsonBody } from "./client";
import type { Plan } from "./organizations";

export type Subscription = {
  id: string;
  plan: Plan;
  status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED";
  amount: string;
  currency: "NGN";
  trialStart: string | null;
  trialEnd: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  nextPaymentDue: string | null;
};

export const getSubscription = () =>
  apiRequest<{ subscription: Subscription }>("/api/billing/subscription");

export const createSubscriptionCheckout = (plan: Plan) =>
  apiRequest<{ paymentId: string; checkoutUrl: string; amount: number; currency: "NGN" }>(
    "/api/billing/checkout",
    { method: "POST", body: jsonBody({ plan }) },
  );
