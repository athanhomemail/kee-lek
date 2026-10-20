export function lotteryGroups(items = [], kindOf = (item) => item.kind) {
  const groups = new Map([
    ["หวยไทย", []],
    ["หวยนอก", []],
  ]);
  for (const item of items) {
    const kind = kindOf(item) || "อื่น ๆ";
    if (!groups.has(kind)) groups.set(kind, []);
    groups.get(kind).push(item);
  }
  return [...groups]
    .filter(([, items]) => items.length)
    .map(([kind, items]) => ({ kind, items }));
}
export const sortLotteries = (items) =>
  lotteryGroups(items).flatMap((group) => group.items);
