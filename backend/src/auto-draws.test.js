import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultDrawSchedule,
  validateDrawSchedule,
  nextScheduledDraw,
  previousDrawReady,
} from "./auto-draws.js";
const now = new Date("2026-11-09T09:00:00+07:00");
const schedule = (overrides) => ({
  ...defaultDrawSchedule,
  enabled: true,
  days: [1, 2, 3, 4, 5],
  resultTime: "20:00",
  ...overrides,
});
test("monthly, weekdays and weekends follow the configured calendar from Nov 9 2026", () => {
  assert.equal(
    nextScheduledDraw(schedule({ mode: "monthdays", days: [1, 16] }), now)
      .drawDate,
    "2026-11-16",
  );
  assert.equal(nextScheduledDraw(schedule(), now).drawDate, "2026-11-09");
  assert.equal(
    nextScheduledDraw(schedule({ days: [6, 7] }), now).drawDate,
    "2026-11-14",
  );
  assert.equal(nextScheduledDraw(defaultDrawSchedule, now), null);
});
test("calendar uses Bangkok midnight, skips past result times and nonexistent month days", () => {
  assert.equal(
    nextScheduledDraw(
      schedule({ days: [1, 2, 3, 4, 5, 6, 7] }),
      new Date("2026-11-08T17:00:00Z"),
    ).drawDate,
    "2026-11-09",
  );
  assert.equal(
    nextScheduledDraw(schedule(), new Date("2026-11-09T20:00:00+07:00"))
      .drawDate,
    "2026-11-10",
  );
  assert.equal(
    nextScheduledDraw(
      schedule({ mode: "monthdays", days: [31] }),
      new Date("2026-11-01T09:00:00+07:00"),
    ).drawDate,
    "2026-12-31",
  );
  assert.equal(
    nextScheduledDraw(
      schedule({ mode: "monthdays", days: [29] }),
      new Date("2027-02-01T09:00:00+07:00"),
    ).drawDate,
    "2027-03-29",
  );
  assert.equal(
    nextScheduledDraw(
      schedule({ mode: "monthdays", days: [29] }),
      new Date("2028-02-01T09:00:00+07:00"),
    ).drawDate,
    "2028-02-29",
  );
  assert.equal(
    nextScheduledDraw(
      schedule({ mode: "monthdays", days: [1] }),
      new Date("2026-12-02T09:00:00+07:00"),
    ).drawDate,
    "2027-01-01",
  );
  const overnight = nextScheduledDraw(
    schedule({ resultTime: "01:00", resultDayOffset: 1 }),
    now,
  );
  assert.equal(overnight.drawDate, "2026-11-09");
  assert.equal(overnight.resultAt.toISOString(), "2026-11-09T18:00:00.000Z");
});
test("previous draw must have all results; first draw may bootstrap", () => {
  assert.equal(previousDrawReady(null, now), true);
  const previous = {
    top3: "000",
    top2: "00",
    bottom2: "00",
    result_at: "2026-11-08T20:00:00+07:00",
  };
  assert.equal(previousDrawReady(previous, now), true);
  for (const field of ["top3", "top2", "bottom2"])
    assert.equal(previousDrawReady({ ...previous, [field]: null }, now), false);
  assert.equal(
    previousDrawReady(
      { ...previous, result_at: "2026-11-09T20:00:00+07:00" },
      now,
    ),
    true,
  );
});
test("schedule validation rejects incomplete or malformed rules and normalizes duplicate days", () => {
  for (const value of [
    schedule({ days: [] }),
    schedule({ days: [0] }),
    schedule({ days: [8] }),
    schedule({ days: ["1"] }),
    schedule({ mode: "other" }),
    schedule({ resultTime: "24:00" }),
    schedule({ resultTime: "" }),
    schedule({ resultDayOffset: -1 }),
    schedule({ resultDayOffset: 8 }),
    schedule({ enabled: "true" }),
  ])
    assert.throws(() => validateDrawSchedule(value));
  assert.deepEqual(
    validateDrawSchedule(schedule({ days: [5, 1, 5] })).days,
    [1, 5],
  );
  assert.doesNotThrow(() => validateDrawSchedule(defaultDrawSchedule));
});
