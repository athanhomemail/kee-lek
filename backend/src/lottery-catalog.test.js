import test from "node:test";
import assert from "node:assert/strict";
import { bangkokToday, hideUnpublished } from "./lottery-catalog.js";
test("catalog day uses Bangkok midnight and history hides future publication", () => {
  assert.equal(bangkokToday(new Date("2026-10-20T17:00:00Z")), "2026-10-21");
  const draws = [
    {
      id: 1,
      result_at: "2026-10-21T12:00:00+07:00",
      top3: "123",
      top2: "23",
      bottom2: "45",
    },
  ];
  assert.equal(
    hideUnpublished(draws, "Member", Date.parse("2026-10-20"))[0].top3,
    null,
  );
  assert.equal(
    hideUnpublished(draws, "Admin", Date.parse("2026-10-20"))[0].top3,
    "123",
  );
  assert.equal(draws[0].top3, "123");
});
