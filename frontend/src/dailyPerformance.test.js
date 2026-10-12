import test from "node:test";
import assert from "node:assert/strict";
import { dailyPerformance } from "./dailyPerformance.js";
const now = Date.parse("2026-10-12T21:00:00+07:00");
const draws = [
  {
    id: 1,
    name: "หวยไทย",
    draw_date: "2026-10-12",
    result_at: "2026-10-12T16:30:00+07:00",
    top3: "123",
    top2: "23",
    bottom2: "45",
  },
  {
    id: 2,
    name: "หวยลาว",
    draw_date: "2026-10-12",
    result_at: "2026-10-12T20:00:00+07:00",
    top3: "999",
    top2: "99",
    bottom2: "00",
  },
  {
    id: 3,
    name: "รอผล",
    draw_date: "2026-10-12",
    result_at: "2026-10-12T23:00:00+07:00",
    top3: "123",
    top2: "23",
    bottom2: "45",
  },
  {
    id: 4,
    name: "ก่อนหน้า",
    draw_date: "2026-10-11",
    result_at: "2026-10-11T20:00:00+07:00",
    top3: "123",
    top2: "23",
    bottom2: "45",
  },
];
const bills = [
  {
    id: 1,
    leader_id: 7,
    draw_id: 1,
    status: "active",
    currency: "THB",
    gross: 1000,
    win: 1500,
  },
  {
    id: 2,
    leader_id: 7,
    draw_id: 2,
    status: "active",
    currency: "LAK",
    gross: 65,
    win: 32.5,
  },
  {
    id: 3,
    leader_id: 7,
    draw_id: 3,
    status: "active",
    currency: "THB",
    gross: 5000,
    win: 900000,
  },
  {
    id: 4,
    leader_id: 7,
    draw_id: 1,
    status: "cancelled",
    currency: "THB",
    gross: 900,
    win: 900,
  },
  {
    id: 5,
    leader_id: 8,
    draw_id: 1,
    status: "active",
    currency: "THB",
    gross: 100000,
    win: 0,
  },
  {
    id: 6,
    leader_id: 7,
    draw_id: 4,
    status: "active",
    currency: "THB",
    gross: 100,
    win: 0,
  },
];
test("daily performance groups all lotteries by draw date and excludes cancelled or other leader bills", () => {
  const result = dailyPerformance(
    bills,
    draws,
    7,
    [{ leader_id: 7, rate: 650 }],
    now,
  );
  assert.equal(result.length, 2);
  assert.equal(result[0].date, "2026-10-12");
  assert.equal(result[0].draws.length, 3);
  assert.equal(result[0].count, 3);
  assert.equal(result[0].pendingCount, 1);
  assert.deepEqual(result[0].received, { THB: 6000, LAK: 65 });
  assert.deepEqual(result[0].paid, { THB: 1500, LAK: 32.5 });
  assert.deepEqual(result[0].profit, { THB: -500, LAK: 32.5 });
  assert.equal(result[0].profitTHB, -450);
  assert.equal(result[0].receivedTHB, 6100);
  assert.equal(result[0].pendingTHB, 5000);
  assert.equal(result[1].profitTHB, 100);
});
test("unpublished results are not counted as payouts or profit until release", () => {
  const before = dailyPerformance([bills[2]], draws, 7, [], now)[0];
  assert.deepEqual(before.paid, { THB: 0, LAK: 0 });
  assert.deepEqual(before.profit, { THB: 0, LAK: 0 });
  assert.equal(before.pendingCount, 1);
  const after = dailyPerformance(
    [bills[2]],
    draws,
    7,
    [],
    Date.parse("2026-10-13T00:00:00+07:00"),
  )[0];
  assert.equal(after.profit.THB, 5000 - 900000);
  assert.equal(after.pendingCount, 0);
});
test("missing exchange rates leave native money visible and converted totals unavailable", () => {
  const result = dailyPerformance(bills, draws, 7, [], now);
  assert.equal(result[0].profitTHB, null);
  assert.equal(result[0].receivedTHB, null);
  assert.equal(result[1].profitTHB, 100);
  assert.deepEqual(dailyPerformance([], draws, 7, [], now), []);
  assert.deepEqual(dailyPerformance(bills, [], 7, [], now), []);
});
