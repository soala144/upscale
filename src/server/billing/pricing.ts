// Single source of truth lives in @/lib/plans so the billing page and the server agree on prices.
export {
  subscriptionPlanIds,
  subscriptionPlans,
  trialDurationDays,
  type SubscriptionPlan,
} from "@/lib/plans";
