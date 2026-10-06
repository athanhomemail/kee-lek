import test from "node:test";
import assert from "node:assert/strict";
import { nextDraws, resultDraws, homePage } from "./draws.js";
const now = Date.parse("2026-10-05T12:00:00+07:00");
const draws = [
  { id: 1, lottery_id: 1, result_at: "2026-10-01T16:00:00+07:00" },
  { id: 2, lottery_id: 1, result_at: "2026-10-16T16:00:00+07:00" },
  { id: 3, lottery_id: 1, result_at: "2026-11-01T16:00:00+07:00" },
  { id: 4, lottery_id: 1, result_at: "2026-11-16T16:00:00+07:00" },
  { id: 5, lottery_id: 3, result_at: "2026-10-06T20:00:00+07:00" },
];
test("only closest upcoming draw per lottery despite unordered input", () =>
  assert.deepEqual(
    nextDraws([...draws].reverse(), now).map((d) => d.id),
    [5, 2],
  ));
test("results include closest future plus history, never later future draws", () =>
  assert.deepEqual(
    resultDraws(draws, now).map((d) => d.id),
    [2, 5, 1],
  ));
test("automatically advances at publication time", () =>
  assert.deepEqual(
    nextDraws(draws, Date.parse(draws[1].result_at)).map((d) => d.id),
    [3],
  ));
test("role default landing pages", () => {
  assert.equal(homePage("Member"), "คีย์");
  assert.equal(homePage("Leader"), "ผล");
  assert.equal(homePage("Admin"), "ผล");
});
