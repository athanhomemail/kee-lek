import React, { useState } from "react";
import { ChevronDown, UserRound, Trash2, Pencil } from "lucide-react";
import LotteryFlag from "./LotteryFlag.jsx";
import { labels } from "./keying.js";
import { billResultStatus } from "./billResults.js";

const money = (n) =>
  Number(n || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export default function BillCard({ b, state, cancel, edit }) {
  const [expanded, setExpanded] = useState(false);
  const draw = state.draws.find((d) => String(d.id) === String(b.draw_id));
  const setting = state.drawSettings?.find(
    (s) => String(s.draw_id) === String(b.draw_id),
  )?.config;
  const editable =
    setting?.closeAt &&
    Date.now() <
      Math.min(
        new Date(setting.closeAt).getTime(),
        new Date(draw?.result_at).getTime(),
      );
  const result = billResultStatus(b, draw);
  const status = {
    won: "ถูกรางวัล",
    lost: "ไม่ถูกรางวัล",
    pending: "รอผลรางวัล",
    cancelled: "ยกเลิกแล้ว",
  }[result];
  const currency = b.currency || b.items?.[0]?.currency || "THB";
  const unit = currency === "LAK" ? "K กีบ" : "บาท";
  const owner =
    b.member_name ||
    state.users?.find((u) => String(u.id) === String(b.member_id))?.name ||
    (String(state.user.id) === String(b.member_id)
      ? state.user.name
      : `สมาชิก #${b.member_id}`);
  const drawDate = draw?.draw_date
    ? new Date(draw.draw_date).toLocaleDateString("th-TH")
    : "—";
  const created = b.created_at
    ? new Date(b.created_at).toLocaleString("th-TH", {
        timeZone: "Asia/Bangkok",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "";
  return (
    <details
      className={`bill bill-card bill-${result}`}
      onToggle={(e) => setExpanded(e.currentTarget.open)}
    >
      <summary>
        <div className="bill-card-info">
          <div className="bill-card-meta">
            <span>โพย #{String(b.id).padStart(5, "0")}</span>
            <span className="bill-currency">{unit}</span>
          </div>
          <strong className="bill-lottery">
            <LotteryFlag flag={draw?.flag} />
            {draw?.name || "ไม่พบงวดหวย"}
          </strong>
          <span className="bill-draw-date">งวด {drawDate}</span>
          <small className="bill-owner">
            <UserRound size={12} />
            {owner}
          </small>
        </div>
        <div className="bill-card-amount">
          <small>ยอดซื้อ</small>
          <b>
            {money(b.gross)} <span>{unit}</span>
          </b>
          <small>{b.items.length} รายการ</small>
        </div>
        <div className="bill-card-result">
          <span className={`bill-status bill-status-${result}`}>{status}</span>
          {result === "won" ? (
            <div className="bill-prize">
              <small>ยอดรางวัล</small>
              <strong>
                {money(b.win)} <span>{unit}</span>
              </strong>
            </div>
          ) : (
            <small>
              {result === "pending"
                ? "ยังไม่มีผลสำหรับโพยนี้"
                : result === "cancelled"
                  ? "ไม่นับในยอดรับซื้อ"
                  : "ไม่มีรายการถูกรางวัล"}
            </small>
          )}
        </div>
        <span className="bill-expand">
          <ChevronDown size={18} />
          <small>รายละเอียด</small>
        </span>
      </summary>
      {expanded && (
        <div className="bill-details">
          <div className="bill-detail-heading">
            <h3>รายการเลขในโพย</h3>
            <span>
              {created ? `บันทึก ${created}` : `${b.items.length} รายการ`}
            </span>
          </div>
          <div className="bill-items-scroll">
            <table className="bill-items-table">
              <thead>
                <tr>
                  <th>เลข</th>
                  <th>ประเภท</th>
                  <th>ยอดซื้อ ({unit})</th>
                  <th>อัตราจ่าย</th>
                </tr>
              </thead>
              <tbody>
                {b.items.map((item, index) => (
                  <tr key={index}>
                    <td>
                      <b className="bill-number">{item.number}</b>
                    </td>
                    <td>{labels[item.type] || item.type}</td>
                    <td>{money(item.amount)}</td>
                    <td>
                      {money(item.rate)} <small>ต่อ 1 {unit}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan={2}>ยอดรวม</th>
                  <td>{money(b.gross)}</td>
                  <td>{unit}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          {b.note && (
            <div className="bill-note">
              <span>หมายเหตุ</span>
              <p>{b.note}</p>
            </div>
          )}
          {editable && b.status === "active" && (edit || cancel) && (
            <div className="bill-actions">
              {edit && (
                <button onClick={edit}>
                  <Pencil size={14} />
                  แก้ไขโพย
                </button>
              )}
              {cancel && (
                <button className="bill-cancel-action" onClick={cancel}>
                  <Trash2 size={14} />
                  ยกเลิกโพย
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </details>
  );
}
