import test from "node:test";
import assert from "node:assert/strict";
import { drawConfig, salesOpen } from "./rules.js";

test("one lottery cutoff applies to each draw date and overrides legacy rules", () => {
  const settings = { closeTime: "20:30" };
  const rules = { closeAt: "2026-10-01T01:00:00Z", blocked: ["12"] };
  for (const day of ["2026-10-19", "2026-10-22"]) {
    const config = drawConfig({ draw_date: day }, settings, rules);
    assert.equal(config.closeAt, `${day}T13:30:00.000Z`);
    assert.deepEqual(config.blocked, ["12"]);
  }
  assert.equal(
    drawConfig({ draw_date: "2026-10-22" }, { closeTime: "00:00" }).closeAt,
    "2026-10-21T17:00:00.000Z",
  );
});

test("sales close at the cutoff or result time, including edits and cancellations", () => {
  const draw = { draw_date: "2026-10-19", result_at: "2026-10-19T14:00:00Z" };
  const config = drawConfig(draw, { closeTime: "20:30" });
  assert.equal(
    salesOpen(draw, config, Date.parse("2026-10-19T13:29:59Z")),
    true,
  );
  assert.equal(salesOpen(draw, config, Date.parse(config.closeAt)), false);
  assert.equal(
    salesOpen(
      draw,
      drawConfig(draw, { closeTime: "23:00" }),
      Date.parse(draw.result_at),
    ),
    false,
  );
  assert.equal(salesOpen(draw, drawConfig(draw), 0), false);
  assert.equal(
    drawConfig(draw, {}, { closeAt: config.closeAt }).closeAt,
    config.closeAt,
  );
});
