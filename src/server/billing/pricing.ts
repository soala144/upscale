export const subscriptionPlanIds = ["BASIC", "GROWTH", "SCALE"] as const;

export type SubscriptionPlan = (typeof subscriptionPlanIds)[number];

export const subscriptionPlans = {
  BASIC: {
    name: "Basic",
    monthlyAmount: 3_500,
    currency: "NGN",
  },
  GROWTH: {
    name: "Growth",
    monthlyAmount: 5_000,
    currency: "NGN",
    recommended: true,
  },
  SCALE: {
    name: "Scale",
    monthlyAmount: 10_000,
    currency: "NGN",
  },
} as const satisfies Record<
  SubscriptionPlan,
  { name: string; monthlyAmount: number; currency: "NGN"; recommended?: true }
>;

export const trialDurationDays = 14;
