export const reportCurrencyOf = (bill) =>
  bill.currency || bill.items?.[0]?.currency || "THB";

export function currencyTotals(bills, field = "gross") {
  const totals = { THB: 0, LAK: 0 };
  for (const bill of bills) {
    if (bill.status !== "active") continue;
    const currency = reportCurrencyOf(bill);
    totals[currency] =
      Math.round((totals[currency] + Number(bill[field] || 0)) * 100) / 100;
  }
  return totals;
}

export function rankedNumbers(
  bills,
  drawId,
  sortCurrency = "THB",
  direction = "desc",
  type = "",
) {
  const rows = new Map();
  for (const bill of bills) {
    if (bill.status !== "active" || String(bill.draw_id) !== String(drawId))
      continue;
    const currency = reportCurrencyOf(bill);
    for (const item of bill.items) {
      if (type && item.type !== type) continue;
      const key = `${item.type}:${item.number}`;
      if (!rows.has(key))
        rows.set(key, {
          key,
          number: item.number,
          type: item.type,
          THB: 0,
          LAK: 0,
          count: 0,
        });
      const row = rows.get(key);
      row[currency] =
        Math.round((row[currency] + Number(item.amount)) * 100) / 100;
      row.count++;
    }
  }
  return [...rows.values()].sort(
    (a, b) =>
      (direction === "asc" ? 1 : -1) * (a[sortCurrency] - b[sortCurrency]) ||
      a.number.localeCompare(b.number) ||
      a.type.localeCompare(b.type),
  );
}

export const reportTypes = [
  "3top",
  "3tod",
  "2top",
  "2bottom",
  "runTop",
  "runBottom",
];
const roundMoney = (value) => Math.round(value * 100) / 100;
export const drawBills = (bills, drawId) =>
  bills.filter(
    (bill) =>
      bill.status === "active" && String(bill.draw_id) === String(drawId),
  );

export function winsForResult(item, top3, bottom2) {
  const top2 = top3.slice(-2);
  switch (item.type) {
    case "3top":
      return item.number === top3;
    case "3tod":
      return [...item.number].sort().join("") === [...top3].sort().join("");
    case "2top":
      return item.number === top2;
    case "2bottom":
      return item.number === bottom2;
    case "runTop":
      return top2.includes(item.number);
    case "runBottom":
      return bottom2.includes(item.number);
    default:
      return false;
  }
}

export function reportGroups(bills, drawId, by = "type", users = []) {
  const groups = new Map();
  if (by === "type")
    for (const type of reportTypes)
      groups.set(type, { key: type, THB: 0, LAK: 0 });
  for (const bill of drawBills(bills, drawId)) {
    const currency = reportCurrencyOf(bill);
    for (const item of bill.items || []) {
      const key = by === "type" ? item.type : String(bill.member_id);
      if (!groups.has(key))
        groups.set(key, {
          key,
          name:
            bill.member_name ||
            users.find((u) => String(u.id) === key)?.name ||
            `สมาชิก #${key}`,
          THB: 0,
          LAK: 0,
        });
      groups.get(key)[currency] += Number(item.amount || 0);
    }
  }
  return [...groups.values()].map((row) => ({
    ...row,
    THB: roundMoney(row.THB),
    LAK: roundMoney(row.LAK),
  }));
}

export function forecastReport(
  bills,
  drawId,
  side = "top",
  fixedResult = "00",
) {
  const selected = drawBills(bills, drawId);
  const purchase = Object.fromEntries(
    reportTypes.map((type) => [type, { THB: 0, LAK: 0 }]),
  );
  const entries = selected.flatMap((bill) =>
    (bill.items || []).map((item) => ({
      ...item,
      currency: reportCurrencyOf(bill),
    })),
  );
  const received = { THB: 0, LAK: 0 };
  for (const item of entries) {
    if (purchase[item.type])
      purchase[item.type][item.currency] += Number(item.amount);
    received[item.currency] += Number(item.net ?? item.amount);
  }
  const rows = Array.from(
    { length: side === "top" ? 1000 : 100 },
    (_, index) => {
      const number = String(index).padStart(side === "top" ? 3 : 2, "0");
      const top3 = side === "top" ? number : fixedResult;
      const bottom2 = side === "bottom" ? number : fixedResult;
      const payout = Object.fromEntries(
        reportTypes.map((type) => [type, { THB: 0, LAK: 0 }]),
      );
      let count = 0;
      for (const item of entries)
        if (winsForResult(item, top3, bottom2)) {
          count++;
          payout[item.type][item.currency] +=
            Number(item.amount) * Number(item.rate || 0);
        }
      const paid = { THB: 0, LAK: 0 };
      for (const type of reportTypes)
        for (const currency of ["THB", "LAK"]) {
          payout[type][currency] = roundMoney(payout[type][currency]);
          paid[currency] += payout[type][currency];
        }
      return {
        number,
        top3,
        top2: top3.slice(-2),
        bottom2,
        payout,
        paid,
        count,
        THB: roundMoney(received.THB - paid.THB),
        LAK: roundMoney(received.LAK - paid.LAK),
      };
    },
  );
  for (const type of reportTypes)
    for (const currency of ["THB", "LAK"])
      purchase[type][currency] = roundMoney(purchase[type][currency]);
  return {
    purchase,
    received: { THB: roundMoney(received.THB), LAK: roundMoney(received.LAK) },
    rows,
  };
}
