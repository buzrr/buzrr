import { describe, expect, it } from "vitest";
import { discountRejection, quoteFromPreview } from "../pricing.service";

const PRO = "pdt_pro";
const NOW = new Date("2026-09-14T12:00:00Z");

const base = {
  starts_at: null,
  expires_at: null,
  usage_limit: null,
  times_used: 0,
  restricted_to: [] as string[],
};

describe("discountRejection", () => {
  it("accepts an unrestricted, unexpired code", () => {
    expect(discountRejection(base, PRO, NOW)).toBeNull();
    expect(
      discountRejection({ ...base, restricted_to: [PRO] }, PRO, NOW),
    ).toBeNull();
  });

  it("rejects codes that haven't started or have expired", () => {
    expect(
      discountRejection(
        { ...base, starts_at: "2026-10-01T00:00:00Z" },
        PRO,
        NOW,
      ),
    ).toMatch(/isn't active yet/);
    expect(
      discountRejection(
        { ...base, expires_at: "2026-09-01T00:00:00Z" },
        PRO,
        NOW,
      ),
    ).toMatch(/expired/);
  });

  it("rejects fully redeemed codes and codes for other products", () => {
    expect(
      discountRejection(
        { ...base, usage_limit: 100, times_used: 100 },
        PRO,
        NOW,
      ),
    ).toMatch(/fully redeemed/);
    expect(
      discountRejection({ ...base, restricted_to: ["pdt_other"] }, PRO, NOW),
    ).toMatch(/doesn't apply/);
  });
});

describe("quoteFromPreview", () => {
  // Shapes taken from a real test-mode preview: ₹399 localized price with a
  // 20% product discount, GST included.
  const indiaLine = {
    currency: "INR" as const,
    og_price: 39900,
    discounted_price: 31920,
    tax_inclusive: true,
  };

  it("reports a product-level discount using Dodo's own numbers", () => {
    expect(quoteFromPreview(indiaLine, null)).toEqual({
      currency: "INR",
      amount: 39900,
      taxInclusive: true,
      discount: {
        source: "product",
        code: null,
        name: null,
        percentOff: 20,
        amountOff: 7980,
        subscriptionCycles: null,
        expiresAt: null,
        discountedAmount: 31920,
      },
    });
  });

  it("attributes the reduction to a code and carries its terms", () => {
    const quote = quoteFromPreview(
      {
        currency: "USD",
        og_price: 499,
        discounted_price: 374,
        tax_inclusive: false,
      },
      {
        code: "LAUNCH25",
        name: "Launch",
        subscription_cycles: 3,
        expires_at: "2026-10-01T00:00:00Z",
      },
    );
    expect(quote.discount).toMatchObject({
      source: "code",
      code: "LAUNCH25",
      percentOff: 25,
      amountOff: 125,
      subscriptionCycles: 3,
      discountedAmount: 374,
    });
  });

  it("returns no discount when Dodo charges the list price", () => {
    expect(
      quoteFromPreview({ ...indiaLine, discounted_price: 39900 }, null)
        .discount,
    ).toBeNull();
  });
});
