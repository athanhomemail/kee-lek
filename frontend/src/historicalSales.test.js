import test from "node:test";
import assert from "node:assert/strict";
import { historicalSales } from "./historicalSales.js";
test("historical sections separate lottery, owner and currency without cancelled amounts or decimal drift", () => {
  const bills = [
    {
      id: 1,
      status: "active",
      draw_id: 1,
      leader_id: 10,
      member_id: 20,
      gross: 0.1,
      items: [],
    },
    {
      id: 2,
      status: "active",
      draw_id: 1,
      leader_id: 10,
      member_id: 20,
      gross: 0.2,
      items: [],
    },
    {
      id: 3,
      status: "active",
      draw_id: 2,
      leader_id: 10,
      member_id: 21,
      gross: 20,
      items: [{ currency: "LAK" }],
      member_name: "Past member",
    },
    {
      id: 4,
      status: "cancelled",
      draw_id: 1,
      leader_id: 10,
      member_id: 20,
      gross: 999,
      items: [],
    },
  ];
  const draws = [
    { id: 1, lottery_id: 1, name: "Thai" },
    { id: 2, lottery_id: 2, name: "Lao" },
  ];
  const lotteries = [
    { id: 1, name: "Thai" },
    { id: 2, name: "Lao" },
    { id: 3, name: "No sales" },
  ];
  const leaders = historicalSales(
    bills,
    draws,
    lotteries,
    [{ id: 10, name: "Leader" }],
    "Admin",
  );
  assert.deepEqual(leaders.people, [
    { id: "10", name: "Leader", count: 3, THB: 0.3, LAK: 20 },
  ]);
  assert.equal(leaders.lotteries[0].THB, 0.3);
  assert.equal(leaders.lotteries[1].LAK, 20);
  assert.equal(leaders.lotteries[2].count, 0);
  const members = historicalSales(
    bills,
    draws,
    lotteries,
    [{ id: 20, name: "Member" }],
    "Leader",
  );
  assert.equal(members.people[0].count, 2);
  assert.equal(members.people[1].name, "Past member");
  assert.equal(members.people[1].LAK, 20);
});
