import React from "react";
import { calculateDiscount, discountGroups } from "./discounts.js";
import { labels } from "./keying.js";
export default function DiscountSummary({
  items,
  rates,
  currency = "THB",
  details = false,
}) {
  const result = calculateDiscount(items, rates);
  const money = (n) =>
    `${n.toLocaleString("th-TH", { maximumFractionDigits: 2 })} ${currency === "LAK" ? "K กีบ" : "บาท"}`;
  return (
    <div className="discount-summary compact-discount">
      <div className="discount-total">
        <strong>ส่วนลดที่ให้ได้</strong>
        <b>{money(result.discount)}</b>
      </div>
      {details && (
        <div className="discount-mode-list">
          {discountGroups(result).map((r) => (
            <span key={r.type}>
              {labels[r.type]} <small>({r.percent}%)</small>{" "}
              <b>{money(r.discountAmount)}</b>
            </span>
          ))}
        </div>
      )}
      <p>
        ยอดเต็ม {money(result.gross)} · ถ้าให้ส่วนลด{" "}
        <b>{money(result.payable)}</b>
      </p>
    </div>
  );
}
