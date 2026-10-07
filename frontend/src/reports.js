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
