import React, { useState } from "react";
import { winningBills } from "./reports.js";
import { labels } from "./keying.js";
const money = (n) =>
  Number(n).toLocaleString("th-TH", { maximumFractionDigits: 2 });
export default function WinningReport({ bills, draw }) {
  const [memberId, setMemberId] = useState("");
  const all = winningBills(bills, draw);
  const members = [
    ...new Map(
      all.map((b) => [
        String(b.member_id),
        b.member_name || `สมาชิก #${b.member_id}`,
      ]),
    ).entries(),
  ];
  const visible = all.filter(
    (b) => !memberId || String(b.member_id) === memberId,
  );
  const totals = visible.reduce(
    (s, b) => ({ ...s, [b.currency]: s[b.currency] + b.winningTotal }),
    { THB: 0, LAK: 0 },
  );
  const published =
    draw?.top3 &&
    draw?.top2 &&
    draw?.bottom2 &&
    Date.now() >= new Date(draw.result_at).getTime();
  return (
    <div>
      <h3>บิลที่ถูกรางวัลตามผลจริง</h3>
      {!published ? (
        <p className="risk-empty">
          ยังไม่ออกผล รายงานนี้จะแสดงหลังเผยแพร่ผลครบทั้งสามประเภท
        </p>
      ) : (
        <>
          <p>
            ผลจริง: 3 ตัวบน <b>{draw.top3}</b> · 2 ตัวบน <b>{draw.top2}</b> · 2
            ตัวล่าง <b>{draw.bottom2}</b>
          </p>
          <div className="toolbar">
            <label>
              สมาชิกที่ถูกรางวัล
              <select
                value={members.some(([id]) => id === memberId) ? memberId : ""}
                onChange={(e) => setMemberId(e.target.value)}
              >
                <option value="">สมาชิกทุกคนที่ถูก</option>
                {members.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="risk-cards">
            <div className="risk-card">
              <span>บิลที่ถูก</span>
              <strong>{visible.length} บิล</strong>
            </div>
            <div className="risk-card">
              <span>เงินรางวัลรวม (บาท)</span>
              <strong>{money(totals.THB)}</strong>
            </div>
            <div className="risk-card">
              <span>เงินรางวัลรวม (K กีบ)</span>
              <strong>{money(totals.LAK)}</strong>
            </div>
          </div>
          <div className="report-table-scroll">
            <table className="report-table">
              <thead>
                <tr>
                  <th>สมาชิก</th>
                  <th>เลขบิล</th>
                  <th>รายการที่ถูก</th>
                  <th>เงินรางวัลรวม</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((b) => (
                  <tr key={b.id}>
                    <td>{b.member_name || `สมาชิก #${b.member_id}`}</td>
                    <td>#{b.id}</td>
                    <td>
                      {b.winningItems.map((item, index) => (
                        <div key={index}>
                          {labels[item.type]} · <b>{item.number}</b> · ซื้อ{" "}
                          {money(item.amount)} × อัตรา {money(item.rate)} ={" "}
                          <b>{money(item.payout)}</b>{" "}
                          {b.currency === "THB" ? "บาท" : "K กีบ"}
                        </div>
                      ))}
                    </td>
                    <td>
                      <strong>{money(b.winningTotal)}</strong>{" "}
                      {b.currency === "THB" ? "บาท" : "K กีบ"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!visible.length && (
            <p className="risk-empty">ไม่มีบิลที่ถูกรางวัลในงวดนี้</p>
          )}
          <p className="muted">
            ไม่รวมบิลที่ยกเลิก ·
            เงินรางวัลใช้ยอดซื้อและอัตราจ่ายที่บันทึกไว้ในแต่ละรายการ · 1 K =
            1,000 กีบ
          </p>
        </>
      )}
    </div>
  );
}
