import test from "node:test";
import assert from "node:assert/strict";
import { lotteryGroups, sortLotteries } from "./lotteryOrder.js";
test("Thai lotteries always precede foreign lotteries while preserving order within each group", () => {
  const lotteries = [
    { id: 1, kind: "หวยนอก" },
    { id: 2, kind: "หวยไทย" },
    { id: 3, kind: "หวยนอก" },
    { id: 4, kind: "หวยไทย" },
  ];
  assert.deepEqual(
    sortLotteries(lotteries).map((l) => l.id),
    [2, 4, 1, 3],
  );
  assert.deepEqual(
    lotteryGroups(lotteries).map((g) => g.kind),
    ["หวยไทย", "หวยนอก"],
  );
  assert.deepEqual(
    lotteries.map((l) => l.id),
    [1, 2, 3, 4],
  );
});
test("mixed draw dropdowns group by their lottery and omit empty headings", () => {
  const draws = [
    { id: 10, lottery_id: 1 },
    { id: 11, lottery_id: 2 },
    { id: 12, lottery_id: 1 },
  ];
  const kinds = { 1: "หวยนอก", 2: "หวยไทย" };
  const groups = lotteryGroups(draws, (d) => kinds[d.lottery_id]);
  assert.deepEqual(
    groups.map((g) => g.items.map((d) => d.id)),
    [[11], [10, 12]],
  );
  assert.deepEqual(
    lotteryGroups([{ kind: "หวยนอก" }]).map((g) => g.kind),
    ["หวยนอก"],
  );
  assert.deepEqual(sortLotteries([]), []);
});
