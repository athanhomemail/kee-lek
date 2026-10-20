import test from "node:test";
import assert from "node:assert/strict";
import { calculateDiscount, discountTypes } from "./discounts.js";
test("unconfigured and legacy bills keep full amount", () => {
  assert.deepEqual(
    calculateDiscount([{ number: "12", type: "2top", amount: 100 }]),
    {
      rows: [
        {
          number: "12",
          type: "2top",
          amount: 100,
          percent: 0,
          discountAmount: 0,
        },
      ],
      gross: 100,
      discount: 0,
      payable: 100,
    },
  );
});
test("all six modes, currencies, per-line rounding, and full discount", () => {
  for (const currency of ["THB", "LAK"]) {
    const items = discountTypes.map((type, i) => ({
      type,
      number: "1",
      amount: 100,
      currency,
    }));
    const rates = Object.fromEntries(
      discountTypes.map((type, i) => [type, i * 10]),
    );
    const result = calculateDiscount(items, rates);
    assert.equal(result.discount, 150);
    assert.equal(result.payable, 450);
    assert.equal(items[1].discountAmount, undefined);
    assert.equal(
      calculateDiscount(
        items,
        Object.fromEntries(discountTypes.map((k) => [k, 100])),
      ).payable,
      0,
    );
  }
  const result = calculateDiscount(
    [
      { type: "2top", amount: 0.05 },
      { type: "2top", amount: 0.05 },
    ],
    { "2top": 10 },
  );
  assert.equal(result.discount, 0.02);
  assert.equal(result.payable, 0.08);
});

test("compact mode groups preserve per-line rounding and bill totals", async () => {
  const { discountGroups } = await import("./discounts.js");
  const result = calculateDiscount(
    [
      { type: "3top", amount: 100 },
      { type: "2top", amount: 0.05 },
      { type: "2top", amount: 0.05 },
    ],
    { "3top": 20, "2top": 10 },
  );
  const groups = discountGroups(result);
  assert.deepEqual(groups, [
    { type: "3top", percent: 20, discountAmount: 20 },
    { type: "2top", percent: 10, discountAmount: 0.02 },
  ]);
  assert.equal(
    Math.round(groups.reduce((s, r) => s + r.discountAmount, 0) * 100) / 100,
    result.discount,
  );
});
