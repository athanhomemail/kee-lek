import test from "node:test";
import assert from "node:assert/strict";
import { accessTime } from "./access.js";
test("access countdown warns only within three days and never shows negative days", () => {
  const now = Date.parse("2026-10-05T00:00:00Z");
  assert.deepEqual(accessTime(now + 4 * 86400000, now), {
    days: 4,
    expiring: false,
  });
  assert.deepEqual(accessTime(now + 3 * 86400000, now), {
    days: 3,
    expiring: true,
  });
  assert.deepEqual(accessTime(now + 1, now), { days: 1, expiring: true });
  assert.deepEqual(accessTime(now - 1, now), { days: 0, expiring: false });
  assert.deepEqual(accessTime("invalid", now), { days: 0, expiring: false });
});
