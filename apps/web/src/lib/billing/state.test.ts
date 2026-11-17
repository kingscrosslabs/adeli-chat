import { describe, expect, it } from "vitest";

import { planOf } from "./state";

const NOW = new Date("2026-12-17T19:00:00Z");
const before = new Date("2026-12-17T18:55:00Z");
const after = new Date("2026-12-18T18:55:00Z");

describe("planOf", () => {
  it("is Pro while active, trialing or past due, and Free otherwise", () => {
    for (const status of ["active", "trialing", "past_due"]) expect(planOf({ subscriptionStatus: status, cancelAtPeriodEnd: false, currentPeriodEnd: after }, NOW)).toBe("pro");
    for (const status of ["canceled", "unpaid", "incomplete", null]) expect(planOf({ subscriptionStatus: status, cancelAtPeriodEnd: false, currentPeriodEnd: after }, NOW)).toBe("free");
    expect(planOf(null, NOW)).toBe("free");
  });

  it("keeps a cancelled subscription Pro until its end date, then Free even with no webhook", () => {
    expect(planOf({ subscriptionStatus: "active", cancelAtPeriodEnd: true, currentPeriodEnd: after }, NOW)).toBe("pro");
    expect(planOf({ subscriptionStatus: "active", cancelAtPeriodEnd: true, currentPeriodEnd: before }, NOW)).toBe("free");
  });

  it("doesn't end an uncancelled subscription at its period end: renewal is Stripe's to report", () => {
    expect(planOf({ subscriptionStatus: "active", cancelAtPeriodEnd: false, currentPeriodEnd: before }, NOW)).toBe("pro");
  });
});
