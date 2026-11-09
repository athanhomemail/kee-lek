import test from "node:test";
import assert from "node:assert/strict";
import {
  validDrawDate,
  validateDrawExceptions,
  manualMoveException,
  manualSkipException,
} from "./draw-exceptions.js";
import { nextScheduledDraw, defaultDrawSchedule } from "./auto-draws.js";
const monthly = {
  ...defaultDrawSchedule,
  enabled: true,
  mode: "monthdays",
  days: [1, 16],
  resultTime: "16:00",
};
const now = new Date("2026-11-09T09:00:00+07:00");
test("monthly exception moves only one round and never recreates the original", () => {
  const config = {
    ...monthly,
    exceptions: [{ date: "2026-11-16", action: "move", toDate: "2026-11-17" }],
  };
  for (const date of ["2026-11-09", "2026-11-16", "2026-11-17"])
    assert.equal(
      nextScheduledDraw(config, new Date(date + "T09:00:00+07:00")).drawDate,
      "2026-11-17",
    );
  assert.equal(
    nextScheduledDraw(config, new Date("2026-11-18T09:00:00+07:00")).drawDate,
    "2026-12-01",
  );
});
test("exceptions support weekday, weekend, earlier shifts, year boundaries and skipped rounds", () => {
  const weekday = {
    ...monthly,
    mode: "weekdays",
    days: [1, 2, 3, 4, 5],
    exceptions: [{ date: "2026-11-09", action: "move", toDate: "2026-11-10" }],
  };
  assert.equal(nextScheduledDraw(weekday, now).drawDate, "2026-11-10");
  const weekend = {
    ...monthly,
    mode: "weekdays",
    days: [6],
    exceptions: [{ date: "2026-11-14", action: "move", toDate: "2026-11-17" }],
  };
  assert.equal(nextScheduledDraw(weekend, now).drawDate, "2026-11-17");
  assert.equal(
    nextScheduledDraw(
      {
        ...monthly,
        exceptions: [
          { date: "2026-11-16", action: "move", toDate: "2026-11-15" },
        ],
      },
      now,
    ).drawDate,
    "2026-11-15",
  );
  assert.equal(
    nextScheduledDraw(
      { ...monthly, exceptions: [{ date: "2026-11-16", action: "skip" }] },
      now,
    ).drawDate,
    "2026-12-01",
  );
  assert.equal(
    nextScheduledDraw(
      {
        ...monthly,
        exceptions: [
          { date: "2026-12-16", action: "move", toDate: "2027-01-02" },
          { date: "2027-01-01", action: "skip" },
        ],
      },
      new Date("2026-12-10T09:00:00+07:00"),
    ).drawDate,
    "2027-01-02",
  );
});
test("exception publication time overrides the ordinary date and survives original date passing", () => {
  const target = nextScheduledDraw(
    {
      ...monthly,
      exceptions: [
        {
          date: "2026-11-01",
          action: "move",
          toDate: "2026-11-10",
          resultTime: "01:00",
          resultDayOffset: 1,
        },
      ],
    },
    now,
  );
  assert.equal(target.drawDate, "2026-11-10");
  assert.equal(target.resultAt.toISOString(), "2026-11-10T18:00:00.000Z");
});
test("validates calendar dates and rejects duplicate, cyclic and colliding exceptions", () => {
  assert.equal(validDrawDate("2026-02-29"), false);
  assert.equal(validDrawDate("2028-02-29"), true);
  for (const rows of [
    [{ date: "2026-11-16", action: "move", toDate: "2026-11-16" }],
    [
      { date: "2026-11-16", action: "move", toDate: "2026-11-17" },
      { date: "2026-11-17", action: "move", toDate: "2026-11-16" },
    ],
    [
      { date: "2026-11-16", action: "skip" },
      { date: "2026-11-16", action: "skip" },
    ],
    [
      { date: "2026-11-16", action: "move", toDate: "2026-11-19" },
      { date: "2026-11-17", action: "move", toDate: "2026-11-19" },
    ],
    [
      {
        date: "2026-11-16",
        action: "move",
        toDate: "2026-11-17",
        resultTime: "24:00",
      },
    ],
  ])
    assert.throws(() => validateDrawExceptions(rows));
});
test("manual re-moves keep the original exception and deleting a moved draw suppresses both dates", () => {
  const first = manualMoveException(
    monthly,
    "2026-11-16",
    "2026-11-17",
    new Date("2026-11-17T18:30:00+07:00"),
  );
  const second = manualMoveException(
    first,
    "2026-11-17",
    "2026-11-18",
    new Date("2026-11-19T01:00:00+07:00"),
  );
  assert.equal(second.exceptions.length, 1);
  assert.equal(second.exceptions[0].date, "2026-11-16");
  assert.equal(second.exceptions[0].toDate, "2026-11-18");
  assert.equal(second.exceptions[0].resultDayOffset, 1);
  const deleted = manualSkipException(second, "2026-11-18");
  assert.deepEqual(
    deleted.exceptions.map((row) => [row.date, row.action]),
    [
      ["2026-11-16", "skip"],
      ["2026-11-18", "skip"],
    ],
  );
  assert.equal(nextScheduledDraw(deleted, now).drawDate, "2026-12-01");
  const restored = manualMoveException(
    first,
    "2026-11-17",
    "2026-11-16",
    new Date("2026-11-16T16:00:00+07:00"),
  );
  assert.equal(restored.exceptions.length, 0);
});
