const DAY_MS = 24 * 60 * 60 * 1000;

/** A subscription's cycle length — 30 days for MONTHLY, 365 for ANNUAL — used to stamp Subscription.endsAt so the dealer-facing renewal popup knows when to reappear. */
export function computeSubscriptionEndsAt(startsAt: Date, billingCycle: "MONTHLY" | "ANNUAL"): Date {
  const days = billingCycle === "ANNUAL" ? 365 : 30;
  return new Date(startsAt.getTime() + days * DAY_MS);
}
