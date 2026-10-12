import { billResultStatus } from "./billResults.js";
import { kipToBaht, reportCurrencyOf } from "./reports.js";
const currencies = ["THB", "LAK"];
const round = (value) => Math.round(value * 100) / 100;
const bucket = () => ({
  count: 0,
  pendingCount: 0,
  received: { THB: 0, LAK: 0 },
  settledReceived: { THB: 0, LAK: 0 },
  pendingReceived: { THB: 0, LAK: 0 },
  paid: { THB: 0, LAK: 0 },
});
function add(target, bill, settled) {
  const currency = reportCurrencyOf(bill);
  const gross = Number(bill.gross || 0);
  target.count++;
  target.received[currency] += gross;
  if (settled) {
    target.settledReceived[currency] += gross;
    target.paid[currency] += Number(bill.win || 0);
  } else {
    target.pendingCount++;
    target.pendingReceived[currency] += gross;
  }
}
function finish(target, rate) {
  for (const field of [
    "received",
    "settledReceived",
    "pendingReceived",
    "paid",
  ])
    for (const c of currencies) target[field][c] = round(target[field][c]);
  target.profit = Object.fromEntries(
    currencies.map((c) => [
      c,
      round(target.settledReceived[c] - target.paid[c]),
    ]),
  );
  const combined = (values) => {
    const converted = values.LAK === 0 ? 0 : kipToBaht(values.LAK, rate);
    return converted === null ? null : values.THB + converted;
  };
  target.receivedTHB = combined(target.received);
  target.paidTHB = combined(target.paid);
  target.profitTHB = combined(target.profit);
  target.pendingTHB = combined(target.pendingReceived);
  return target;
}

export function dailyPerformance(
  bills,
  draws,
  leaderId,
  exchangeRates = [],
  now = Date.now(),
) {
  const rate = exchangeRates.find(
    (r) => String(r.leader_id) === String(leaderId),
  )?.rate;
  const drawMap = new Map(draws.map((d) => [String(d.id), d]));
  const days = new Map();
  for (const bill of bills) {
    if (bill.status !== "active" || String(bill.leader_id) !== String(leaderId))
      continue;
    const draw = drawMap.get(String(bill.draw_id));
    if (!draw) continue;
    const day = String(draw.draw_date).slice(0, 10);
    if (!days.has(day))
      days.set(day, { date: day, ...bucket(), draws: new Map() });
    const total = days.get(day);
    if (!total.draws.has(String(draw.id)))
      total.draws.set(String(draw.id), { draw, ...bucket() });
    const settled =
      billResultStatus(bill, draw, now) !== "pending" &&
      Number.isFinite(Date.parse(draw.result_at));
    add(total, bill, settled);
    add(total.draws.get(String(draw.id)), bill, settled);
  }
  return [...days.values()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((day) => ({
      ...finish(day, rate),
      draws: [...day.draws.values()].map((row) => finish(row, rate)),
    }));
}
