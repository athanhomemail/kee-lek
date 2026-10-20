import test from "node:test";
import assert from "node:assert/strict";
import { validateDiscountRates, discountTypes } from "./discounts.js";
test("requires six explicit percentage values with at most two decimal places", () => {
  const rates = Object.fromEntries(discountTypes.map((k) => [k, 0]));
  assert.deepEqual(validateDiscountRates(rates), rates);
  for (const value of [-1, 101, 1.001, "10", null, Infinity, NaN])
    assert.throws(() => validateDiscountRates({ ...rates, "2top": value }));
  assert.throws(() => validateDiscountRates({}));
  assert.throws(() => validateDiscountRates({ ...rates, other: 10 }));
  assert.equal(
    validateDiscountRates({ ...rates, "2top": 99.99 })["2top"],
    99.99,
  );
});
