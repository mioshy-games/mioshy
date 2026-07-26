import { describe, expect, it } from "vitest";
import { journeyProductJsonLd } from "@/lib/seo/jsonLd";

const cadences = [
  { cadence: "monthly", price_ils: 69, enabled: true },
  { cadence: "quarterly", price_ils: 177, enabled: true },
  { cadence: "yearly", price_ils: 588, enabled: false }, // disabled → excluded
];

describe("journeyProductJsonLd", () => {
  it("builds an AggregateOffer over enabled cadences (regular price)", () => {
    const node = journeyProductJsonLd(
      { journeyCadences: cadences, activePromo: null },
      { url: "https://mioshy.com/he/pricing", name: "Mioshy — Couples Journey" },
    );
    expect(node).not.toBeNull();
    expect(node!.offers.priceCurrency).toBe("ILS");
    expect(node!.offers.lowPrice).toBe(69);
    expect(node!.offers.highPrice).toBe(177); // yearly excluded (disabled)
    expect(node!.offers.offerCount).toBe(2);
    expect(node!["@id"]).toBe("https://mioshy.com/he/pricing#product");
  });

  it("uses promo first-charge price when a promo applies to a cadence", () => {
    const node = journeyProductJsonLd(
      {
        journeyCadences: cadences,
        activePromo: {
          withoutCoaching: {
            firstChargeByCadence: { monthly: { ils: 37, usd: 10 } },
          },
        },
      },
      { url: "https://mioshy.com/he/pricing", name: "X" },
    );
    expect(node!.offers.lowPrice).toBe(37); // promo beats 69
    expect(node!.offers.highPrice).toBe(177);
  });

  it("returns null when nothing is priced", () => {
    expect(
      journeyProductJsonLd(
        { journeyCadences: [{ cadence: "monthly", price_ils: 0, enabled: true }], activePromo: null },
        { url: "https://mioshy.com/he/pricing", name: "X" },
      ),
    ).toBeNull();
    expect(
      journeyProductJsonLd(
        { journeyCadences: [], activePromo: null },
        { url: "https://mioshy.com/he/pricing", name: "X" },
      ),
    ).toBeNull();
  });
});
