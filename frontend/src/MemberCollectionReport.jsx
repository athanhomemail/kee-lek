import React, { useMemo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { memberCollections, collectionTotals } from "./memberCollections.js";
import { reportCurrencyOf } from "./reports.js";
import BillCard from "./BillCard.jsx";
import BillPages from "./BillPages.jsx";
const money = (n) =>
  Number(n || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const unit = (currency) => (currency === "LAK" ? "K กีบ" : "บาท");

function MemberBillsDialog({ member, bills, state, draw, currency, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const node = dialog.current,
      previous = document.activeElement,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    node.showModal();
    return () => {
      node.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  const visible = bills
    .filter(
      (b) =>
        b.status === "active" &&
        String(b.leader_id) === String(state.user.id) &&
        String(b.draw_id) === String(draw.id) &&
        String(b.member_id) === member.id &&
        (currency === "ALL" || reportCurrencyOf(b) === currency),
    )
    .slice()
    .sort((a, b) => b.id - a.id);
  return createPortal(
    <dialog
      ref={dialog}
      className="result-history-modal member-bills-modal"
      aria-labelledby="member-bills-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="result-history-modal-body">
        <header className="result-history-modal-heading">
          <div>
            <h2 id="member-bills-title">
              ยอดเรียกเก็บและส่วนลดรายบิล · {member.name}
            </h2>
            <p>
              {draw.name} · งวด{" "}
              {String(draw.draw_date)
                .slice(0, 10)
                .split("-")
                .reverse()
                .join("/")}{" "}
              · {currency === "ALL" ? "บาทและกีบ" : unit(currency)}
            </p>
          </div>
          <button
            autoFocus
            aria-label="ปิดรายละเอียดบิลสมาชิก"
            onClick={onClose}
          >
            ✕
          </button>
        </header>
        <div className="result-history-modal-content">
          <div className="collection-dialog-totals">
            {(currency === "ALL" ? ["THB", "LAK"] : [currency]).map((c) => (
              <div key={c}>
                <strong>
                  {unit(c)} · {member[c].count} บิล/โพย
                </strong>
                <span>
                  จ่ายเต็ม {money(member[c].gross)} · ส่วนลด{" "}
                  {money(member[c].discount)} · หลังส่วนลด{" "}
                  {money(member[c].payable)}
                </span>
              </div>
            ))}
          </div>
          <BillPages
            bills={visible}
            renderBill={(b) => <BillCard key={b.id} b={b} state={state} />}
            empty={<p>ไม่มีบิลในงวดและสกุลเงินที่เลือก</p>}
          />
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
export default function MemberCollectionReport({ state, bills, draw }) {
  const [currency, setCurrency] = useState("ALL");
  const [memberId, setMemberId] = useState("");
  const [details, setDetails] = useState(null);
  const members = useMemo(
    () =>
      memberCollections({
        bills,
        users: state.users,
        leaderId: state.user.id,
        drawId: draw.id,
      }),
    [bills, state.users, state.user.id, draw.id],
  );
  const visible = members.filter((m) => !memberId || m.id === memberId);
  const currencies = currency === "ALL" ? ["THB", "LAK"] : [currency];
  const detailMember = details && members.find((m) => m.id === details.id);
  const cells = (row) => (
    <>
      <td>{row.count.toLocaleString("th-TH")}</td>
      <td>{money(row.gross)}</td>
      <td>{money(row.discount)}</td>
      <td>
        <strong>{money(row.payable)}</strong>
      </td>
    </>
  );
  return (
    <section className="member-collection-report">
      <h3>สรุปยอดเรียกเก็บและส่วนลดรายสมาชิก</h3>
      <p className="muted">
        เฉพาะหวยและงวดที่เลือก · ไม่รวมบิลยกเลิก ·
        ส่วนลดเป็นยอดกรณีเลือกให้ลูกค้า ไม่หักยอดขายหรือเงินรางวัลจริง
      </p>
      <div className="toolbar">
        <label>
          สกุลเงิน
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
          >
            <option value="ALL">บาทและกีบ</option>
            <option value="THB">บาท</option>
            <option value="LAK">K กีบ</option>
          </select>
        </label>
        <label>
          สมาชิก
          <select
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
          >
            <option value="">สมาชิกทุกคน</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="report-table-scroll">
        <table className="report-table collection-table">
          <caption>
            ยอดรวมรายสมาชิก · กดชื่อหรือดูบิลเพื่อเปิดรายละเอียด · 1 K = 1,000
            กีบ
          </caption>
          <thead>
            <tr>
              <th>สมาชิก</th>
              <th className="collection-currency-cell">สกุลเงิน</th>
              <th>บิล/โพย</th>
              <th>ยอดซื้อ / จ่ายเต็ม</th>
              <th>ส่วนลดที่ให้ได้</th>
              <th>ยอดหลังส่วนลด</th>
              <th>รายละเอียด</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((member) => (
              <React.Fragment key={member.id}>
                {currencies.map((c, i) => (
                  <tr
                    key={c}
                    className={i === 0 ? "collection-member-start" : ""}
                  >
                    {i === 0 && (
                      <td
                        className="collection-member-cell"
                        rowSpan={currencies.length}
                      >
                        <button
                          className="collection-member-name"
                          disabled={!currencies.some((c) => member[c].count)}
                          onClick={() =>
                            setDetails({ id: member.id, currency })
                          }
                        >
                          {member.name}
                        </button>
                        {member.username && <small>{member.username}</small>}
                        {member.active === 0 && <small>ปิดบัญชีแล้ว</small>}
                      </td>
                    )}
                    <td className="collection-currency-cell">{unit(c)}</td>
                    {cells(member[c])}
                    <td>
                      <button
                        disabled={!member[c].count}
                        onClick={() =>
                          setDetails({ id: member.id, currency: c })
                        }
                      >
                        ดู {member[c].count} บิล
                      </button>
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot>
            {currencies.map((c) => (
              <tr key={c}>
                <th>รวม {visible.length} สมาชิก</th>
                <th className="collection-currency-cell">{unit(c)}</th>
                {cells(collectionTotals(visible, c))}
                <td />
              </tr>
            ))}
          </tfoot>
        </table>
      </div>
      {!visible.length && <p className="muted">ไม่มีสมาชิกในเครือข่าย</p>}
      {detailMember && (
        <MemberBillsDialog
          key={`${draw.id}-${detailMember.id}-${details.currency}`}
          member={detailMember}
          bills={bills}
          state={state}
          draw={draw}
          currency={details.currency}
          onClose={() => setDetails(null)}
        />
      )}
    </section>
  );
}
