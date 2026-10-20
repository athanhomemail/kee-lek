import React from "react";
import { calculateDiscount } from "./discounts.js";
import { labels } from "./keying.js";
export default function DiscountSummary({
  items,
  rates,
  currency = "THB",
  details = false,
}) {
  const result = calculateDiscount(items, rates);
  const money = (n) =>
    `${n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency === "LAK" ? "K กีบ" : "บาท"}`;
  return (
    <div className="discount-summary">
      <strong>ส่วนลดประกอบการเรียกเก็บ</strong>
      <p>
        จ่ายเต็ม {money(result.gross)} · ส่วนลดที่ให้ได้{" "}
        {money(result.discount)} · หากให้ส่วนลด จ่าย {money(result.payable)}
      </p>
      <small>
        เป็นข้อมูลประกอบการตกลงกับลูกค้า ไม่หักยอดบิลหรือยอดรางวัล
        และไม่แสดงในรูปภาพลูกค้า
      </small>
      {details && (
        <details>
          <summary>ส่วนลดแยกตามเลขและโหมด</summary>
          <div className="report-table-scroll">
            <table className="report-table">
              <thead>
                <tr>
                  <th>เลข</th>
                  <th>โหมด</th>
                  <th>ยอดซื้อ</th>
                  <th>ส่วนลด %</th>
                  <th>ส่วนลด</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.number}</td>
                    <td>{labels[r.type]}</td>
                    <td>{money(Number(r.amount))}</td>
                    <td>{r.percent}%</td>
                    <td>{money(r.discountAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
