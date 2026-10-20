import test from "node:test";
import assert from "node:assert/strict";
import { discountTypes } from "./discounts.js";
import {
  rememberDiscounts,
  reconcileDiscounts,
  memberDiscountRates,
} from "./memberDiscountState.js";
const rates = (n) => Object.fromEntries(discountTypes.map((type) => [type, n]));
test("saved single/bulk rates survive stale refreshes and reopening without a reload", () => {
  const records = [{ member_id: 1, lottery_id: 2, rates: rates(0) }];
  const pending = rememberDiscounts({}, [1, 3], 2, rates(15));
  const stale = reconcileDiscounts(pending, records);
  assert.equal(stale, pending);
  assert.deepEqual(memberDiscountRates(records, stale, 1, 2), rates(15));
  assert.deepEqual(memberDiscountRates(records, stale, 3, 2), rates(15));
  assert.deepEqual(memberDiscountRates(records, stale, 1, 4), rates(0));
  assert.deepEqual(memberDiscountRates(records, stale, 5, 2), rates(0));
});
test("fresh shared state acknowledges saves, allowing later updates from other sessions", () => {
  const pending = rememberDiscounts({}, [1, 3], 2, rates(15));
  const records = [{ member_id: 1, lottery_id: 2, rates: rates(15) }];
  const reconciled = reconcileDiscounts(pending, records);
  assert.deepEqual(memberDiscountRates(records, reconciled, 1, 2), rates(15));
  assert.deepEqual(
    memberDiscountRates(
      [{ ...records[0], rates: rates(20) }],
      reconciled,
      1,
      2,
    ),
    rates(20),
  );
  assert.deepEqual(memberDiscountRates([], reconciled, 3, 2), rates(15));
  assert.equal(Object.keys(pending).length, 2);
});
