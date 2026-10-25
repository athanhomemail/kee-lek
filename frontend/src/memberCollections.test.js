import test from "node:test";
import assert from "node:assert/strict";
import { memberCollections, collectionTotals } from "./memberCollections.js";
const users = [
  { id: 1, leader_id: 10, role: "Member", name: "One", active: 1 },
  { id: 2, leader_id: 10, role: "Member", name: "Two", active: 1 },
  { id: 3, leader_id: 11, role: "Member", name: "Other", active: 1 },
  { id: 4, leader_id: 10, role: "Member", name: "Inactive", active: 0 },
];
const bill = (overrides = {}) => ({
  id: 1,
  member_id: 1,
  leader_id: 10,
  draw_id: 20,
  status: "active",
  gross: 100,
  items: [{ number: "12", type: "2top", amount: 100, currency: "THB" }],
  discountRates: { "2top": 10 },
  ...overrides,
});
test("summary isolates team and draw, excludes cancelled bills, and keeps all members including zero sales", () => {
  const bills = [
    bill(),
    bill({
      id: 2,
      currency: "LAK",
      gross: 50,
      items: [
        { type: "2top", number: "12", amount: 20, currency: "LAK" },
        { type: "3top", number: "123", amount: 30, currency: "LAK" },
      ],
      discountRates: { "2top": 10, "3top": 20 },
    }),
    bill({ id: 3, status: "cancelled" }),
    bill({ id: 4, draw_id: 21 }),
    bill({ id: 5, leader_id: 11, member_id: 3 }),
    bill({ id: 6, member_id: 4, discountRates: {} }),
  ];
  const result = memberCollections({ users, bills, leaderId: 10, drawId: 20 });
  assert.deepEqual(
    result.map((m) => m.id),
    ["1", "2", "4"],
  );
  assert.deepEqual(result[0].THB, {
    currency: "THB",
    count: 1,
    itemCount: 1,
    gross: 100,
    discount: 10,
    payable: 90,
  });
  assert.deepEqual(result[0].LAK, {
    currency: "LAK",
    count: 1,
    itemCount: 2,
    gross: 50,
    discount: 8,
    payable: 42,
  });
  assert.equal(result[1].THB.count, 0);
  assert.equal(result[1].LAK.gross, 0);
  assert.equal(result[2].active, 0);
  assert.equal(result[2].THB.payable, 100);
  assert.equal(collectionTotals(result, "THB").gross, 200);
  assert.equal(collectionTotals(result, "LAK").gross, 50);
  assert.equal(collectionTotals([result[0]], "THB").count, 1);
  assert.equal(bills[0].gross, 100);
  assert.equal(bills[0].items[0].discountAmount, undefined);
});
test("aggregates saved per-bill rates with per-item rounding and supports legacy currencies and missing profiles", () => {
  const items = [
    { type: "2top", number: "12", amount: 0.05, currency: "LAK" },
    { type: "2top", number: "34", amount: 0.05, currency: "LAK" },
  ];
  const bills = [
    bill({ gross: 0.1, items }),
    bill({ id: 2, gross: 0.1, items, discountRates: { "2top": 20 } }),
    bill({
      id: 3,
      member_id: 99,
      member_name: "Retained",
      discountRates: undefined,
    }),
  ];
  const result = memberCollections({ users, bills, leaderId: 10, drawId: 20 });
  assert.equal(result[0].LAK.count, 2);
  assert.equal(result[0].LAK.itemCount, 4);
  assert.equal(result[0].LAK.gross, 0.2);
  assert.equal(result[0].LAK.discount, 0.04);
  assert.equal(result[0].LAK.payable, 0.16);
  const retained = result.find((m) => m.id === "99");
  assert.equal(retained.name, "Retained");
  assert.equal(retained.THB.discount, 0);
  assert.equal(retained.THB.payable, 100);
  assert.equal(collectionTotals(result, "THB").count, 1);
});
