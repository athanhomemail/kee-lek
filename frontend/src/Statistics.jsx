import React, { useState } from "react";
import { labels } from "./keying.js";
import { currencyTotals, rankedNumbers, reportCurrencyOf } from "./reports.js";

const money = (n) =>
  Number(n).toLocaleString("th-TH", { maximumFractionDigits: 2 });
const amount = (n, c) => `${money(n)} ${c === "LAK" ? "K กีบ" : "บาท"}`;
const drawLabel = (draw) =>
  `${draw.name} · ${String(draw.draw_date).slice(0, 10)}`;

export default function Statistics({ state, bills }) {
  const [currency, setCurrency] = useState("ALL");
  const [drawId, setDrawId] = useState("");
  const [sortCurrency, setSortCurrency] = useState("THB");
  const [direction, setDirection] = useState("desc");
  const [type, setType] = useState("");
  const currencies = currency === "ALL" ? ["THB", "LAK"] : [currency];
  const visible = bills.filter(
    (b) => currency === "ALL" || reportCurrencyOf(b) === currency,
  );
  const active = visible.filter((b) => b.status === "active");
  const drawIds = new Set(
    bills.filter((b) => b.status === "active").map((b) => String(b.draw_id)),
  );
  const draws = state.draws
    .filter((d) => drawIds.has(String(d.id)))
    .sort(
      (a, b) =>
        String(b.draw_date).localeCompare(String(a.draw_date)) || b.id - a.id,
    );
  const selectedDraw = draws.find((d) => String(d.id) === drawId) || draws[0];
  const ranking = selectedDraw
    ? rankedNumbers(visible, selectedDraw.id, sortCurrency, direction, type)
    : [];
  const amounts = (rows, field = "gross") => {
    const totals = currencyTotals(rows, field);
    return (
      <span className="report-amounts">
        {currencies.map((c) => (
          <span key={c}>{amount(totals[c], c)}</span>
        ))}
      </span>
    );
  };
  return (
    <>
      <div className="toolbar">
        <label>
          สกุลเงินรายงาน
          <select
            value={currency}
            onChange={(e) => {
              setCurrency(e.target.value);
              if (e.target.value !== "ALL") setSortCurrency(e.target.value);
            }}
          >
            <option value="ALL">บาทและกีบ</option>
            <option value="THB">บาท</option>
            <option value="LAK">กีบ (K)</option>
          </select>
        </label>
      </div>
      <div className="cards metrics">
        <div className="panel">
          <p className="muted">จำนวนโพย</p>
          <h2>{active.length}</h2>
        </div>
        <div className="panel">
          <p className="muted">ยอดขาย</p>
          <h2>{amounts(active)}</h2>
        </div>
        <div className="panel">
          <p className="muted">ยอดถูกรางวัล</p>
          <h2>{amounts(active, "win")}</h2>
        </div>
      </div>
      <section className="panel number-ranking">
        <h2>เลขขายสูงสุดในงวด</h2>
        <div className="toolbar">
          <label>
            งวด
            <select
              aria-label="งวดรายงานเลขขายสูงสุด"
              value={selectedDraw?.id || ""}
              onChange={(e) => setDrawId(e.target.value)}
            >
              {!draws.length && <option value="">ไม่มีงวดที่มียอดซื้อ</option>}
              {draws.map((d) => (
                <option key={d.id} value={d.id}>
                  {drawLabel(d)}
                </option>
              ))}
            </select>
          </label>
          <label>
            ประเภทเลข
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">ทุกประเภท</option>
              {Object.entries(labels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            เรียงตามยอด
            <select
              value={sortCurrency}
              onChange={(e) => setSortCurrency(e.target.value)}
            >
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c === "THB" ? "บาท" : "กีบ (K)"}
                </option>
              ))}
            </select>
          </label>
          <label>
            ลำดับ
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
            >
              <option value="desc">มากไปน้อย</option>
              <option value="asc">น้อยไปมาก</option>
            </select>
          </label>
        </div>
        <div className="report-table-scroll">
          <table className="report-table">
            <thead>
              <tr>
                <th>อันดับ</th>
                <th>เลข</th>
                <th>ประเภท</th>
                {currencies.map((c) => (
                  <th key={c}>ยอดซื้อ ({c === "THB" ? "บาท" : "K กีบ"})</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranking.map((row, index) => (
                <tr key={row.key}>
                  <td>{index + 1}</td>
                  <td>
                    <strong>{row.number}</strong>
                  </td>
                  <td>{labels[row.type]}</td>
                  {currencies.map((c) => (
                    <td key={c}>{money(row[c])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!ranking.length && (
          <p className="muted">ไม่มีรายการซื้อในงวดที่เลือก</p>
        )}
      </section>
      <section className="panel">
        <h2>ยอดขายแยกตามประเภทหวย</h2>
        {state.lotteries.map((l) => (
          <div className="item" key={l.id}>
            <span>{l.name}</span>
            <b>
              {amounts(
                active.filter(
                  (b) =>
                    state.draws.find((d) => d.id === b.draw_id)?.lottery_id ===
                    l.id,
                ),
              )}
            </b>
          </div>
        ))}
        {state.user.role !== "Member" && (
          <>
            <h3>
              {state.user.role === "Admin"
                ? "ยอดแยกตาม Leader"
                : "ยอดแยกตามสมาชิก"}
            </h3>
            {state.users.map((person) => {
              const rows = active.filter(
                (b) =>
                  (state.user.role === "Admin" ? b.leader_id : b.member_id) ===
                  person.id,
              );
              return (
                <div className="item" key={person.id}>
                  <span>
                    {person.name} · {rows.length} โพย
                  </span>
                  <b>{amounts(rows)}</b>
                </div>
              );
            })}
          </>
        )}
        <h3>ผลรายโพย</h3>
        {visible
          .slice()
          .reverse()
          .map((b) => {
            const draw = state.draws.find((d) => d.id === b.draw_id);
            return (
              <div className="item" key={b.id}>
                <span>
                  #{b.id} · {draw?.name} ·{" "}
                  {amount(b.gross, reportCurrencyOf(b))}
                </span>
                <b>
                  {b.status === "cancelled"
                    ? "ยกเลิก"
                    : draw?.top3
                      ? b.win > 0
                        ? "ถูกรางวัล " + amount(b.win, reportCurrencyOf(b))
                        : "ไม่ถูกรางวัล"
                      : "รอผล"}
                </b>
              </div>
            );
          })}
      </section>
    </>
  );
}
