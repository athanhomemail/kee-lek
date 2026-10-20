import test from "node:test";
import assert from "node:assert/strict";
import { offeredLotteries } from "./sales.js";
test("new types default to sold, disabled/deleted/team-closed types stay hidden", () => {
  const state = {
    lotteries: [
      { id: 1, enabled: 1 },
      { id: 2, enabled: 1 },
      { id: 3, enabled: 0 },
      { id: 4, enabled: 1, deleted_at: "2026-10-20" },
    ],
    settings: [{ lottery_id: 2, config: { selling: false } }],
  };
  assert.deepEqual(
    offeredLotteries(state).map((l) => l.id),
    [1],
  );
  assert.equal(state.lotteries.length, 4);
});
