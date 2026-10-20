import React from "react";
import { lotteryGroups } from "./lotteryOrder.js";
export default function LotteryOptions({
  items = [],
  lotteries = items,
  getValue = (item) => item.id,
  getLabel = (item) => item.name,
}) {
  return lotteryGroups(
    items,
    (item) =>
      item.kind ||
      lotteries.find((l) => String(l.id) === String(item.lottery_id))?.kind,
  ).map((group) => (
    <optgroup key={group.kind} label={group.kind}>
      {group.items.map((item) => (
        <option key={getValue(item)} value={getValue(item)}>
          {getLabel(item)}
        </option>
      ))}
    </optgroup>
  ));
}
