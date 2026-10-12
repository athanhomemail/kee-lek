import test from "node:test";
import assert from "node:assert/strict";
import { billResultStatus, filterResultBills } from "./billResults.js";
const draw = {
  id: 1,
  top3: "123",
  top2: "23",
  bottom2: "45",
  result_at: "2026-10-12T12:00:00+07:00",
};
const now = Date.parse(draw.result_at);
const bills = [
  { id: 1, draw_id: 1, status: "active", win: 100, currency: "THB" },
  { id: 2, draw_id: 1, status: "active", win: 500, currency: "THB" },
  { id: 3, draw_id: 1, status: "cancelled", win: 1000 },
  { id: 4, draw_id: 1, status: "active", win: 0 },
  { id: 5, draw_id: 1, status: "active", win: 200, currency: "LAK" },
];
test("bill result never shows winner before publication or without complete result", () => {
  assert.equal(billResultStatus(bills[0], draw, now - 1), "pending");
  assert.equal(
    billResultStatus(bills[0], { ...draw, top2: null }, now),
    "pending",
  );
  assert.equal(billResultStatus(bills[0], draw, now), "won");
  assert.equal(billResultStatus(bills[2], draw, now), "cancelled");
  assert.equal(billResultStatus(bills[3], draw, now), "lost");
});
test("prize range and currency filter exclude cancelled and unpublished bills", () => {
  assert.deepEqual(
    filterResultBills(bills, [draw], {
      currency: "THB",
      min: "150",
      max: "600",
      now,
    }).map((b) => b.id),
    [2],
  );
  assert.deepEqual(
    filterResultBills(bills, [draw], {
      status: "won",
      currency: "THB",
      sort: "win",
      now,
    }).map((b) => b.id),
    [2, 1],
  );
  assert.deepEqual(
    filterResultBills(bills, [draw], { min: "0", now: now - 1 }),
    [],
  );
});

test("pagination bounds rendering to 25 of 2000 bills without changing sort order", async () => {
  const { paginateBills } = await import("./billResults.js");
  const many = Array.from({ length: 2000 }, (_, index) => ({
    ...bills[0],
    id: index + 1,
  }));
  const sorted = filterResultBills(many, [draw], { now });
  const first = paginateBills(sorted);
  assert.equal(first.rows.length, 25);
  assert.equal(first.totalPages, 80);
  assert.equal(first.rows[0].id, 2000);
  const last = paginateBills(sorted, 80);
  assert.equal(last.start, 1976);
  assert.equal(last.end, 2000);
  assert.equal(last.rows.at(-1).id, 1);
  const ids = Array.from(
    { length: 80 },
    (_, index) => paginateBills(sorted, index + 1).rows,
  )
    .flat()
    .map((bill) => bill.id);
  assert.equal(new Set(ids).size, 2000);
  assert.equal(many[0].id, 1);
});

test("pagination clamps page when filtering or removing bills and handles empty lists", async () => {
  const { paginateBills } = await import("./billResults.js");
  const smaller = paginateBills(bills, 80);
  assert.equal(smaller.page, 1);
  assert.equal(smaller.rows.length, 5);
  const empty = paginateBills([], 80);
  assert.equal(empty.page, 1);
  assert.equal(empty.start, 0);
  assert.equal(empty.end, 0);
  assert.deepEqual(empty.rows, []);
  assert.equal(paginateBills(bills, 0).page, 1);
});
