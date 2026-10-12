import test from "node:test";
import assert from "node:assert/strict";
import { nextDraws, resultDraws, homePage, resultColumns } from "./draws.js";
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

const sample = [
  ...["09-01", "09-16", "10-01", "10-16", "11-01"].map((day) => ({
    id: `thai-${day}`,
    lottery_id: 1,
    draw_date: `2026-${day}`,
  })),
  ...["10-07", "10-08", "10-09", "10-12", "10-13", "10-14"].map((day) => ({
    id: `lao-${day}`,
    lottery_id: 2,
    draw_date: `2026-${day}`,
  })),
];
test("result columns keep today's draw after publication and nearest future draw", () => {
  const columns = resultColumns(
    [...sample].reverse(),
    [{ id: 1 }, { id: 2 }],
    Date.parse("2026-10-12T23:59:59+07:00"),
  );
  assert.deepEqual(
    columns.map((c) => c.current.id),
    ["thai-10-16", "lao-10-12"],
  );
  assert.deepEqual(
    columns.map((c) => c.history.map((d) => d.id)),
    [
      ["thai-10-01", "thai-09-16", "thai-09-01"],
      ["lao-10-09", "lao-10-08", "lao-10-07"],
    ],
  );
});
test("result history advances at Bangkok midnight and preserves uneven columns", () => {
  const columns = resultColumns(
    sample,
    [{ id: 1 }, { id: 2 }],
    Date.parse("2026-10-12T17:00:00Z"),
  );
  assert.deepEqual(
    columns.map((c) => c.current.id),
    ["thai-10-16", "lao-10-13"],
  );
  assert.deepEqual(
    columns[1].history.map((d) => d.id),
    ["lao-10-12", "lao-10-09", "lao-10-08", "lao-10-07"],
  );
  assert.equal(columns[0].history.length, 3);
});
test("lottery with only history promotes latest draw without duplicating it", () => {
  const [column] = resultColumns(
    sample.filter((d) => d.lottery_id === 1),
    [],
    Date.parse("2026-12-01T00:00:00+07:00"),
  );
  assert.equal(column.current.id, "thai-11-01");
  assert.deepEqual(
    column.history.map((d) => d.id),
    ["thai-10-16", "thai-10-01", "thai-09-16", "thai-09-01"],
  );
});

test("a single historical draw fills the first row with no history remaining", () => {
  const [column] = resultColumns(
    [sample[0]],
    [],
    Date.parse("2026-12-01T00:00:00+07:00"),
  );
  assert.equal(column.current.id, sample[0].id);
  assert.deepEqual(column.history, []);
});
