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

import { kipToBaht, convertedDrawTotals } from "./reports.js";

test("exchange rates use actual kip per baht while purchases remain in K", () => {
  assert.equal(kipToBaht(65, 650), 100);
  assert.equal(kipToBaht(0.65, 650), 1);
  for (const rate of [0, -1, undefined, Infinity, "bad"])
    assert.equal(kipToBaht(65, rate), null);
  const records = [
    {
      draw_id: 1,
      status: "active",
      leader_id: 1,
      member_id: 2,
      currency: "LAK",
      items: [{ type: "2top", number: "12", amount: 65, rate: 95 }],
    },
    {
      draw_id: 1,
      status: "active",
      leader_id: 3,
      member_id: 4,
      currency: "LAK",
      items: [{ type: "2top", number: "12", amount: 80, rate: 95 }],
    },
    {
      draw_id: 1,
      status: "active",
      leader_id: 1,
      member_id: 2,
      items: [{ type: "2top", number: "12", amount: 50, rate: 95 }],
    },
  ];
  const rates = [
    { leader_id: 1, rate: 650 },
    { leader_id: 3, rate: 800 },
  ];
  assert.deepEqual(convertedDrawTotals(records, 1, rates), {
    lakInTHB: 200,
    totalTHB: 250,
  });
  const members = reportGroups(records, 1, "member", [], rates);
  assert.equal(members[0].LAK, 65);
  assert.equal(members[0].lakInTHB, 100);
  assert.equal(members[0].totalTHB, 150);
  const type = reportGroups(records, 1, "type", [], rates)[2];
  assert.equal(type.totalTHB, 250);
  const winning = forecastReport(records, 1, "top", "00", rates).rows[112];
  assert.equal(winning.lakPaidInTHB, 19000);
  assert.equal(winning.lakProfitInTHB, -18800);
  assert.equal(winning.totalProfitTHB, 250 - 19000 - 4750);
  assert.equal(
    convertedDrawTotals(records, 1, [{ leader_id: 1, rate: 650 }]).totalTHB,
    null,
  );
  assert.equal(reportGroups(records, 1, "member", [], [])[0].totalTHB, null);
  assert.equal(
    forecastReport(records, 1, "top", "00", []).rows[112].totalProfitTHB,
    null,
  );
  assert.deepEqual(convertedDrawTotals([], 1, []), {
    lakInTHB: 0,
    totalTHB: 0,
  });
});

test("changing report exchange rates never changes native purchases or winnings", () => {
  const bills = [
    {
      draw_id: 1,
      leader_id: 1,
      member_id: 2,
      status: "active",
      currency: "LAK",
      items: [{ type: "2top", number: "12", amount: 65, rate: 95 }],
    },
  ];
  const original = structuredClone(bills);
  const first = forecastReport(bills, 1, "top", "00", [
    { leader_id: 1, rate: 650 },
  ]);
  const second = forecastReport(bills, 1, "top", "00", [
    { leader_id: 1, rate: 1000 },
  ]);
  assert.deepEqual(first.purchase, second.purchase);
  assert.deepEqual(first.received, second.received);
  assert.deepEqual(first.rows[112].payout, second.rows[112].payout);
  assert.equal(first.rows[112].LAK, second.rows[112].LAK);
  assert.notEqual(
    first.convertedReceived.lakInTHB,
    second.convertedReceived.lakInTHB,
  );
  assert.deepEqual(bills, original);
});

import { numberExposure, resultScenario } from "./reports.js";
test("number exposure merges tod permutations and sums saved rates separately by currency", () => {
  const records = [
    {
      draw_id: 1,
      status: "active",
      items: [
        { type: "3tod", number: "321", amount: 10, rate: 75 },
        { type: "3tod", number: "123", amount: 20, rate: 37.5 },
        { type: "2top", number: "23", amount: 5, rate: 95 },
      ],
    },
    {
      draw_id: 1,
      status: "active",
      currency: "LAK",
      items: [{ type: "3tod", number: "213", amount: 1, rate: 75 }],
    },
    {
      draw_id: 1,
      status: "cancelled",
      items: [{ type: "3tod", number: "123", amount: 100, rate: 75 }],
    },
  ];
  const rows = numberExposure(records, 1);
  assert.deepEqual(
    rows.find((r) => r.type === "3tod"),
    {
      key: "3tod:123",
      type: "3tod",
      number: "123",
      amount: 30,
      payout: 1500,
      count: 2,
    },
  );
  assert.equal(numberExposure(records, 1, "LAK")[0].payout, 75);
  assert.deepEqual(numberExposure(records, 2), []);
});
test("explicit scenario respects recorded top2 independently of top3", () => {
  const records = [
    {
      draw_id: 1,
      status: "active",
      items: [
        { type: "3top", number: "123", amount: 10, rate: 900 },
        { type: "2top", number: "45", amount: 20, rate: 95 },
        { type: "2top", number: "23", amount: 30, rate: 95 },
        { type: "runTop", number: "4", amount: 10, rate: 3 },
        { type: "runTop", number: "2", amount: 10, rate: 3 },
      ],
    },
  ];
  const report = resultScenario(records, 1, {
    top3: "123",
    top2: "45",
    bottom2: "00",
  });
  assert.equal(report.paid.THB, 10930);
  assert.equal(report.count, 3);
  assert.equal(report.profit.THB, 80 - 10930);
  assert.equal(report.payout["2top"].THB, 1900);
});

import { winningBills } from "./reports.js";
test("winning bills wait for publication, exclude cancellations, and preserve member and saved payouts", () => {
  const draw = {
    id: 1,
    top3: "123",
    top2: "45",
    bottom2: "00",
    result_at: "2026-10-12T12:00:00+07:00",
  };
  const records = [
    {
      id: 7,
      member_id: 2,
      member_name: "A",
      draw_id: 1,
      status: "active",
      items: [
        { type: "2top", number: "45", amount: 10, rate: 47.5 },
        { type: "2top", number: "23", amount: 20, rate: 95 },
      ],
    },
    {
      id: 8,
      member_id: 3,
      draw_id: 1,
      status: "active",
      currency: "LAK",
      items: [{ type: "3tod", number: "321", amount: 2, rate: 75 }],
    },
    {
      id: 9,
      draw_id: 1,
      status: "cancelled",
      items: [{ type: "3top", number: "123", amount: 100, rate: 900 }],
    },
    {
      id: 10,
      draw_id: 2,
      status: "active",
      items: [{ type: "3top", number: "123", amount: 100, rate: 900 }],
    },
  ];
  assert.deepEqual(
    winningBills(records, draw, Date.parse(draw.result_at) - 1),
    [],
  );
  const rows = winningBills(records, draw, Date.parse(draw.result_at));
  assert.deepEqual(
    rows.map((r) => [r.id, r.currency, r.winningTotal]),
    [
      [7, "THB", 475],
      [8, "LAK", 150],
    ],
  );
  assert.equal(rows[0].winningItems.length, 1);
  assert.equal(rows[0].member_name, "A");
  assert.deepEqual(
    winningBills(records, { ...draw, top2: null }, Date.parse(draw.result_at)),
    [],
  );
});

test("ranking payout uses each saved rate, separates currencies and includes matching tod permutations", () => {
  const rows = rankedNumbers(
    [
      {
        draw_id: 10,
        status: "active",
        items: [
          { type: "2top", number: "12", amount: 100, rate: 95 },
          { type: "2top", number: "12", amount: 50, rate: 47.5 },
          { type: "3tod", number: "123", amount: 10, rate: 150 },
          { type: "3tod", number: "321", amount: 20, rate: 75 },
        ],
      },
      {
        draw_id: 10,
        status: "active",
        currency: "LAK",
        items: [{ type: "2top", number: "12", amount: 2, rate: 90 }],
      },
      {
        draw_id: 10,
        status: "cancelled",
        items: [{ type: "2top", number: "12", amount: 1000, rate: 100 }],
      },
      {
        draw_id: 11,
        status: "active",
        items: [{ type: "2top", number: "12", amount: 1000, rate: 100 }],
      },
    ],
    10,
  );
  assert.deepEqual(rows.find((r) => r.key === "2top:12").payout, {
    THB: 11875,
    LAK: 180,
  });
  assert.equal(rows.find((r) => r.key === "3tod:123").payout.THB, 3000);
  assert.equal(rows.find((r) => r.key === "3tod:321").payout.THB, 3000);
});

test("ranking excess subtracts purchases across all modes in the same draw and currency, even with a type filter", () => {
  const bills = [
    {
      draw_id: 1,
      status: "active",
      items: [
        { type: "2top", number: "12", amount: 100, rate: 95 },
        { type: "3top", number: "123", amount: 900, rate: 900 },
      ],
    },
    {
      draw_id: 1,
      status: "active",
      currency: "LAK",
      items: [
        { type: "2top", number: "12", amount: 2, rate: 90 },
        { type: "runTop", number: "1", amount: 200, rate: 3 },
      ],
    },
    {
      draw_id: 1,
      status: "cancelled",
      items: [{ type: "3top", number: "999", amount: 99999, rate: 900 }],
    },
    {
      draw_id: 2,
      status: "active",
      items: [{ type: "3top", number: "999", amount: 99999, rate: 900 }],
    },
  ];
  const row = rankedNumbers(bills, 1, "THB", "desc", "2top")[0];
  assert.deepEqual(row.payout, { THB: 9500, LAK: 180 });
  assert.deepEqual(row.excess, { THB: 8500, LAK: 0 });
  assert.deepEqual(
    rankedNumbers(bills, 1).find((r) => r.key === row.key).excess,
    row.excess,
  );
});

test("ranking excess retains two decimal places without floating-point residue", () => {
  const row = rankedNumbers(
    [
      {
        draw_id: 1,
        status: "active",
        items: [
          { type: "2top", number: "01", amount: 0.1, rate: 3 },
          { type: "2bottom", number: "02", amount: 0.1, rate: 3 },
        ],
      },
    ],
    1,
  )[0];
  assert.equal(row.excess.THB, 0.1);
});
