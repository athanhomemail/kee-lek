import { reportCurrencyOf } from "./reports.js";
const empty = (id, name) => ({ id, name, count: 0, THB: 0, LAK: 0 });
export function historicalSales(bills, draws, lotteries, users, role) {
  const drawMap = new Map(draws.map((d) => [String(d.id), d]));
  const lotteryMap = new Map(
    lotteries.map((l) => [String(l.id), empty(String(l.id), l.name)]),
  );
  const peopleMap = new Map(
    users.map((u) => [String(u.id), empty(String(u.id), u.name)]),
  );
  for (const b of bills) {
    if (b.status !== "active") continue;
    const draw = drawMap.get(String(b.draw_id)),
      currency = reportCurrencyOf(b);
    if (!["THB", "LAK"].includes(currency)) continue;
    if (draw) {
      const id = String(draw.lottery_id);
      if (!lotteryMap.has(id))
        lotteryMap.set(id, empty(id, draw.name || `หวย #${id}`));
      const row = lotteryMap.get(id);
      row.count++;
      row[currency] += Math.round(Number(b.gross) * 100);
    }
    const id = String(role === "Admin" ? b.leader_id : b.member_id);
    if (!peopleMap.has(id))
      peopleMap.set(
        id,
        empty(
          id,
          role === "Admin" ? `Leader #${id}` : b.member_name || `สมาชิก #${id}`,
        ),
      );
    const row = peopleMap.get(id);
    row.count++;
    row[currency] += Math.round(Number(b.gross) * 100);
  }
  const finish = (map) =>
    [...map.values()].map((r) => ({
      ...r,
      THB: r.THB / 100,
      LAK: r.LAK / 100,
    }));
  return { lotteries: finish(lotteryMap), people: finish(peopleMap) };
}
