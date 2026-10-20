import { discountTypes } from "./discounts.js";
const key = (memberId, lotteryId) => `${memberId}:${lotteryId}`;

// Keep acknowledged saves visible while the shared state refresh is in flight.
export function rememberDiscounts(pending, memberIds, lotteryId, rates) {
  const next = { ...pending };
  for (const id of memberIds) next[key(id, lotteryId)] = { ...rates };
  return next;
}
export function reconcileDiscounts(pending, records = []) {
  let next = pending;
  for (const record of records) {
    const id = key(record.member_id, record.lottery_id);
    if (
      pending[id] &&
      discountTypes.every(
        (type) => Number(record.rates?.[type] ?? 0) === pending[id][type],
      )
    ) {
      if (next === pending) next = { ...pending };
      delete next[id];
    }
  }
  return next;
}
export function memberDiscountRates(records, pending, memberId, lotteryId) {
  return (
    pending[key(memberId, lotteryId)] ||
    records?.find(
      (record) =>
        String(record.member_id) === String(memberId) &&
        String(record.lottery_id) === String(lotteryId),
    )?.rates ||
    Object.fromEntries(discountTypes.map((type) => [type, 0]))
  );
}
