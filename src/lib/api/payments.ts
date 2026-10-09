import { apiRequest, jsonBody } from "./client";

export type Payment = {
  id: string;
  leadId: string | null;
  type: "SUBSCRIPTION" | "CUSTOMER_PURCHASE";
  status: "PENDING" | "PAID" | "FAILED" | "CANCELLED";
  amount: string;
  currency: string;
  checkoutId: string | null;
  providerReference: string | null;
  platformFee: string;
  description: string | null;
  checkoutUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export const getPayments = async () =>
  (await apiRequest<{ payments: Payment[] }>("/api/payments")).payments;

export const createCustomerCheckout = (input: {
  leadId?: string;
  amount: number;
  description?: string;
}) =>
  apiRequest<{
    paymentId: string;
    checkoutUrl: string;
    amount: string;
    currency: "NGN";
  }>("/api/payments/customer-checkout", {
    method: "POST",
    body: jsonBody(input),
  });
