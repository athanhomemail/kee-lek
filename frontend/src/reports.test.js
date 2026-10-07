import test from "node:test";
import assert from "node:assert/strict";
import { currencyTotals, rankedNumbers } from "./reports.js";

const bills = [
  {
    draw_id: 1,
    status: "active",
    gross: 120,
    win: 950,
    items: [
      { number: "01", type: "2top", amount: 100 },
      { number: "01", type: "2bottom", amount: 20 },
    ],
  },
  {
    draw_id: 1,
    status: "active",
    currency: "LAK",
    gross: 12,
    win: 80,
    items: [
      { number: "01", type: "2top", amount: 2, currency: "LAK" },
      { number: "02", type: "2top", amount: 10, currency: "LAK" },
    ],
  },
  {
    draw_id: 1,
    status: "active",
    gross: 50,
    win: 0,
    items: [{ number: "01", type: "2top", amount: 50 }],
  },
  {
    draw_id: 2,
    status: "active",
    gross: 999,
    win: 0,
    items: [{ number: "99", type: "2top", amount: 999 }],
  },
  {
    draw_id: 1,
    status: "cancelled",
    gross: 9999,
    win: 9999,
    items: [{ number: "99", type: "2top", amount: 9999 }],
  },
];

test("totals keep baht and K separate and exclude cancelled bills", () => {
  assert.deepEqual(currencyTotals(bills), { THB: 1169, LAK: 12 });
  assert.deepEqual(currencyTotals(bills, "win"), { THB: 950, LAK: 80 });
  assert.deepEqual(currencyTotals([]), { THB: 0, LAK: 0 });
});

test("ranking isolates the draw and bet type while aggregating duplicate purchases", () => {
  const rows = rankedNumbers(bills, "1", "THB");
  assert.equal(rows.length, 3);
  assert.equal(rows[0].number, "01");
  assert.equal(rows[0].type, "2top");
  assert.equal(rows[0].THB, 150);
  assert.equal(rows[0].LAK, 2);
  assert.equal(rows.find((row) => row.type === "2bottom").THB, 20);
  assert.ok(rows.every((row) => row.number !== "99"));
});

test("ranking sorts independently by kip or baht in either direction", () => {
  assert.equal(rankedNumbers(bills, 1, "LAK")[0].number, "02");
  assert.equal(rankedNumbers(bills, 1, "LAK", "asc")[0].type, "2bottom");
  assert.equal(rankedNumbers(bills, 1, "THB", "asc")[0].number, "02");
  assert.equal(rankedNumbers(bills, 1, "LAK", "desc", "2top").length, 2);
  assert.deepEqual(rankedNumbers(bills, 3), []);
});

test("legacy kip records and decimal amounts retain their unit", () => {
  const rows = [
    {
      draw_id: 1,
      status: "active",
      gross: 0.3,
      items: [
        { number: "01", type: "2top", currency: "LAK", amount: 0.1 },
        { number: "01", type: "2top", currency: "LAK", amount: 0.2 },
      ],
    },
  ];
  assert.deepEqual(currencyTotals(rows), { THB: 0, LAK: 0.3 });
  assert.equal(rankedNumbers(rows, 1, "LAK")[0].LAK, 0.3);
});
