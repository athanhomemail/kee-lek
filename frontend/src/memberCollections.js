import { calculateDiscount } from "./discounts.js";
import { reportCurrencyOf } from "./reports.js";
const empty = (currency) => ({
  currency,
  count: 0,
  itemCount: 0,
  gross: 0,
  discount: 0,
  payable: 0,
});
const cents = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100);

export function memberCollections({
  bills = [],
  users = [],
  leaderId,
  drawId,
}) {
  const members = new Map();
  for (const user of users) {
    if (user.role === "Member" && String(user.leader_id) === String(leaderId))
      members.set(String(user.id), {
        id: String(user.id),
        name: user.name,
        username: user.username,
        active: user.active,
        THB: empty("THB"),
        LAK: empty("LAK"),
      });
  }
  const visibleBills = bills.filter(
    (b) =>
      b.status === "active" &&
      String(b.leader_id) === String(leaderId) &&
      String(b.draw_id) === String(drawId),
  );
  for (const bill of visibleBills) {
    const id = String(bill.member_id);
    if (!members.has(id))
      members.set(id, {
        id,
        name: bill.member_name || `สมาชิก #${id}`,
        THB: empty("THB"),
        LAK: empty("LAK"),
      });
    const currency = reportCurrencyOf(bill);
    if (!["THB", "LAK"].includes(currency)) continue;
    const row = members.get(id)[currency];
    row.count++;
    row.itemCount += (bill.items || []).length;
    row.gross += cents(bill.gross);
    row.discount += cents(
      calculateDiscount(bill.items, bill.discountRates).discount,
    );
  }
  // Accumulate integer cents; kip stays in the application's K unit, never converted to baht.
  for (const member of members.values())
    for (const currency of ["THB", "LAK"]) {
      const row = member[currency];
      row.payable = (row.gross - row.discount) / 100;
      row.gross /= 100;
      row.discount /= 100;
    }
  return [...members.values()];
}
export function collectionTotals(members, currency) {
  const total = empty(currency);
  for (const member of members) {
    const row = member[currency];
    total.count += row.count;
    total.itemCount += row.itemCount;
    for (const field of ["gross", "discount", "payable"])
      total[field] += cents(row[field]);
  }
  for (const field of ["gross", "discount", "payable"]) total[field] /= 100;
  return total;
}
