export const discountTypes = [
  "3top",
  "3tod",
  "2top",
  "2bottom",
  "runTop",
  "runBottom",
];
const round = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export function calculateDiscount(items = [], rates = {}) {
  const rows = items.map((item) => {
    const percent = Math.min(100, Math.max(0, Number(rates[item.type]) || 0));
    return {
      ...item,
      percent,
      discountAmount: round((Number(item.amount) * percent) / 100),
    };
  });
  const gross = round(items.reduce((s, i) => s + Number(i.amount), 0));
  const discount = round(rows.reduce((s, i) => s + i.discountAmount, 0));
  return { rows, gross, discount, payable: round(gross - discount) };
}

// Sum rounded item discounts, so compact mode totals match recorded bill previews.
export function discountGroups(result) {
  const groups = new Map();
  for (const row of result.rows) {
    if (!groups.has(row.type))
      groups.set(row.type, {
        type: row.type,
        percent: row.percent,
        discountAmount: 0,
      });
    const group = groups.get(row.type);
    group.discountAmount = round(group.discountAmount + row.discountAmount);
  }
  return discountTypes
    .filter((type) => groups.has(type))
    .map((type) => groups.get(type));
}
