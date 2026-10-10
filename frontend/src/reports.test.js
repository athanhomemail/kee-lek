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

import { forecastReport, reportGroups, winsForResult } from "./reports.js";

test("forecast combines all winning types using the recorded rates and excludes other draws and cancellations", () => {
  const items = [
    { type: "3top", number: "112", amount: 10, rate: 900 },
    { type: "3tod", number: "121", amount: 20, rate: 75 },
    { type: "2top", number: "12", amount: 30, rate: 95 },
    { type: "runTop", number: "1", amount: 40, rate: 3 },
    { type: "2bottom", number: "11", amount: 50, rate: 95 },
    { type: "runBottom", number: "1", amount: 60, rate: 4 },
  ];
  const records = [
    { draw_id: 1, member_id: 2, status: "active", items },
    {
      draw_id: 1,
      member_id: 3,
      status: "active",
      currency: "LAK",
      items: [{ type: "2top", number: "12", amount: 2, rate: 90 }],
    },
    { draw_id: 2, status: "active", items },
    { draw_id: 1, status: "cancelled", items },
  ];
  const forecast = forecastReport(records, "1", "top", "11");
  const row = forecast.rows.find((r) => r.number === "112");
  assert.equal(forecast.rows.length, 1000);
  assert.equal(row.count, 7);
  assert.equal(row.paid.THB, 18460);
  assert.equal(row.THB, 210 - 18460);
  assert.equal(row.LAK, 2 - 180);
  assert.deepEqual(forecast.received, { THB: 210, LAK: 2 });
  assert.equal(forecast.rows[0].number, "000");
  const bottom = forecastReport(records, 1, "bottom", "112");
  assert.equal(bottom.rows.length, 100);
  assert.equal(bottom.rows[11].THB, row.THB);
  assert.equal(bottom.rows[11].count, row.count);
});

test("running repeated digits pay once per item and permutations preserve digit multiplicities", () => {
  assert.equal(
    winsForResult({ type: "runTop", number: "1" }, "111", "11"),
    true,
  );
  assert.equal(
    winsForResult({ type: "3tod", number: "122" }, "112", "11"),
    false,
  );
  const report = forecastReport(
    [
      {
        draw_id: 1,
        status: "active",
        items: [{ type: "runTop", number: "1", amount: 0.1, rate: 3 }],
      },
    ],
    1,
  );
  assert.equal(report.rows[111].paid.THB, 0.3);
  assert.equal(report.rows[111].count, 1);
  assert.equal(report.rows[111].THB, -0.2);
});

test("member and type reports isolate a draw and keep currencies separate", () => {
  const records = bills.map((b) => ({
    ...b,
    member_id: 2,
    member_name: "member1",
  }));
  const members = reportGroups(records, 1, "member");
  assert.deepEqual(members, [{ key: "2", name: "member1", THB: 170, LAK: 12 }]);
  const types = reportGroups(records, 1);
  assert.equal(types.length, 6);
  assert.deepEqual(
    types.find((r) => r.key === "2top"),
    { key: "2top", THB: 150, LAK: 12 },
  );
  assert.deepEqual(reportGroups(records, 3, "member"), []);
});
