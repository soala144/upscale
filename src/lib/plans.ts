/** Plan catalogue shared by the server (pricing) and the billing UI. */
export const subscriptionPlanIds = ["BASIC", "GROWTH", "SCALE"] as const;
export type SubscriptionPlan = (typeof subscriptionPlanIds)[number];

export const subscriptionPlans = {
  BASIC: {
    name: "Basic",
    description: "For teams starting with lead qualification.",
    monthlyAmount: 3_500,
    currency: "NGN",
  },
  GROWTH: {
    name: "Growth",
    description: "For growing teams ready to convert more.",
    monthlyAmount: 5_000,
    currency: "NGN",
    recommended: true,
  },
  SCALE: {
    name: "Scale",
    description: "For businesses building a repeatable sales engine.",
    monthlyAmount: 10_000,
    currency: "NGN",
  },
} as const;

export const trialDurationDays = 14;
