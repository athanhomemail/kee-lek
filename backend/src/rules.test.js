import test from "node:test";
import assert from "node:assert/strict";
import { price, defaults, winnings } from "./rules.js";
test("legacy discounts are ignored and full amounts are recorded", () => {
  const b = price(
    [
      { number: "32", type: "2top", amount: 100 },
      { number: "323", type: "3top", amount: 200 },
    ],
    { ...defaults, discounts: { "2top": 10, "3top": 0 } },
  );
  assert.equal(b.gross, 300);
  assert.equal(b.net, 300);
  assert.ok(b.items.every((item) => !Object.hasOwn(item, "discount")));
});
test("blocked numbers and malformed amounts are rejected", () => {
  assert.throws(() =>
    price([{ number: "32", type: "2top", amount: 100 }], {
      ...defaults,
      blocked: ["32"],
    }),
  );
  for (const i of [
    { number: "3", type: "2top", amount: 10 },
    { number: "32", type: "2top", amount: -1 },
    { number: "32", type: "bad", amount: 10 },
  ])
    assert.throws(() => price([i], defaults));
});
test("half pay is snapshotted and leading zero numbers survive", () => {
  const b = price([{ number: "01", type: "2top", amount: 100 }], {
    ...defaults,
    half: ["01"],
  });
  assert.equal(b.items[0].rate, 47.5);
  assert.equal(winnings(b, { top2: "01" }), 4750);
});
test("tod and running follow requested rules", () => {
  const b = price(
    [
      { number: "321", type: "3tod", amount: 10 },
      { number: "2", type: "runTop", amount: 10 },
    ],
    defaults,
  );
  assert.equal(winnings(b, { top3: "123", top2: "23" }), 1530);
});
test("valid decimal amounts do not fail due to floating point representation", () => {
  assert.equal(
    price([{ number: "32", type: "2top", amount: 19.99 }], defaults).net,
    19.99,
  );
  assert.throws(() =>
    price([{ number: "32", type: "2top", amount: 1.001 }], defaults),
  );
});

test("pricing preserves duplicate entries and their identity", () => {
  const items = ["first", "second"].flatMap((entryId) => [
    { entryId, number: "12", type: "2top", amount: 20 },
    { entryId, number: "12", type: "2bottom", amount: 20 },
  ]);
  const bill = price(items, defaults);
  assert.equal(bill.items.length, 4);
  assert.deepEqual(bill.items.map((item) => item.entryId), ["first", "first", "second", "second"]);
  assert.equal(bill.gross, 80);
});
