import Stripe from "stripe";

export type Tier = "free" | "pro";

export const FREE_MONTHLY_DELETION_LIMIT = 50;

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
      apiVersion: "2024-06-20"
    });
  }
  return stripeClient;
}

export function usageRemaining(used: number): number {
  return Math.max(0, FREE_MONTHLY_DELETION_LIMIT - used);
}

export function isOverLimit(used: number): boolean {
  return used >= FREE_MONTHLY_DELETION_LIMIT;
}
