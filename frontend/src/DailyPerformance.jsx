import React, { useMemo, useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { dailyPerformance } from "./dailyPerformance.js";
const money = (value) =>
  value == null
    ? "—"
    : Number(value).toLocaleString("th-TH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
const dateLabel = (date) => date.split("-").reverse().join("-");
const pair = (values) => (
  <span className="daily-money">
    <span>{money(values.THB)} บาท</span>
    <small>{money(values.LAK)} K กีบ</small>
  </span>
);
const resultClass = (value) =>
  value < 0 ? "daily-loss" : value > 0 ? "daily-profit" : "";

export default function DailyPerformance({ state }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [now, setNow] = useState(Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);
  const days = useMemo(
    () =>
      dailyPerformance(
        state.bills || [],
        state.draws,
        state.user.id,
        state.exchangeRates,
        now,
      ),
    [state.bills, state.draws, state.user.id, state.exchangeRates, now],
  );
  const visible = days.filter(
    (day) => (!from || day.date >= from) && (!to || day.date <= to),
  );
  const sum = (field) =>
    visible.some((day) => day[field] == null)
      ? null
      : visible.reduce((s, day) => s + day[field], 0);
  const invalid = from && to && from > to;
  return (
    <section className="panel daily-performance">
      <div className="daily-heading">
        <div>
          <span className="report-eyebrow">ผลประกอบการของเครือข่าย</span>
          <h2>
            <CalendarDays size={21} />
            สรุปผลประกอบการรายวัน
          </h2>
          <p className="muted">
            รวมทุกหวยของ Leader ตามวันที่งวด · กดแต่ละวันเพื่อดูรายละเอียด
          </p>
        </div>
        <span className="bill-count">{visible.length} วัน</span>
      </div>
      <div className="daily-controls">
        <label>
          ตั้งแต่วันที่
          <input
            aria-label="วันเริ่มต้นรายงานรายวัน"
            type="date"
            value={from}
            onInput={(e) => setFrom(e.currentTarget.value)}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          ถึงวันที่
          <input
            aria-label="วันสิ้นสุดรายงานรายวัน"
            type="date"
            value={to}
            onInput={(e) => setTo(e.currentTarget.value)}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button
          onClick={() => {
            setFrom("");
            setTo("");
          }}
        >
          ดูทุกวัน
        </button>
      </div>
      {invalid && (
        <p role="alert" className="daily-loss">
          วันเริ่มต้นต้องไม่เกินวันสิ้นสุด
        </p>
      )}
      <div className="daily-metrics">
        {[
          ["ยอดรับรวม (บาท)", sum("receivedTHB")],
          ["ยอดจ่ายรางวัล (บาท)", sum("paidTHB")],
          ["กำไร / ขาดทุนที่ออกผลแล้ว (บาท)", sum("profitTHB")],
          ["ยอดรับที่รอผล (บาท)", sum("pendingTHB")],
        ].map(([label, value], index) => (
          <div key={label}>
            <span>{label}</span>
            <strong className={index === 2 ? resultClass(value) : ""}>
              {money(value)}
            </strong>
          </div>
        ))}
      </div>
      <p className="daily-description">
        กำไร/ขาดทุน = ยอดรับเฉพาะงวดที่เผยแพร่ผลแล้ว − ยอดจ่ายรางวัล ·
        งวดที่ยังรอผลแสดงแยกและยังไม่นับเป็นกำไร ·
        ไม่รวมโพยยกเลิกและยอดตีออกที่ยังไม่มีข้อมูล
      </p>
      <p className="daily-description">
        ยอดรวมเป็นบาทใช้อัตราแลกเปลี่ยนล่าสุดที่ตั้งไว้ในหวยลาว
        หากยังไม่ตั้งค่าและมีเงินกีบ จะแสดง —
      </p>
      <div className="daily-days">
        {visible.map((day) => (
          <details className="daily-day" key={day.date}>
            <summary>
              <div className="daily-date">
                <strong>{dateLabel(day.date)}</strong>
                <small>
                  {day.draws.length} งวด · {day.count} โพย
                </small>
                <span
                  className={
                    "daily-state " + (day.pendingCount ? "" : "settled")
                  }
                >
                  {day.pendingCount
                    ? `รอผล ${day.pendingCount} โพย`
                    : "ออกผลครบแล้ว"}
                </span>
              </div>
              <div>
                <small>ยอดรับ</small>
                {pair(day.received)}
              </div>
              <div>
                <small>ยอดจ่าย</small>
                {pair(day.paid)}
              </div>
              <div className={resultClass(day.profitTHB)}>
                <small>กำไร / ขาดทุนรวม (บาท)</small>
                <strong>
                  {day.pendingCount === day.count ? "—" : money(day.profitTHB)}
                </strong>
                <small>
                  {money(day.profit.THB)} บาท · {money(day.profit.LAK)} K กีบ
                </small>
              </div>
              <ChevronDown size={18} className="daily-chevron" />
            </summary>
            <div className="daily-breakdown">
              <div className="report-table-scroll">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>หวย / งวด</th>
                      <th>สถานะ</th>
                      <th>โพย</th>
                      <th>ยอดรับ</th>
                      <th>ยอดจ่าย</th>
                      <th>กำไร/ขาดทุน (บาท)</th>
                      <th>กำไร/ขาดทุน (K กีบ)</th>
                      <th>กำไร/ขาดทุนรวม (บาท)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {day.draws.map((row) => (
                      <tr key={row.draw.id}>
                        <td>
                          <strong>{row.draw.name}</strong>
                          <small className="daily-table-date">
                            งวด {dateLabel(day.date)}
                          </small>
                        </td>
                        <td>{row.pendingCount ? "รอผล" : "เผยแพร่ผลแล้ว"}</td>
                        <td>{row.count}</td>
                        <td>{pair(row.received)}</td>
                        <td>{row.pendingCount ? "—" : pair(row.paid)}</td>
                        <td className={resultClass(row.profit.THB)}>
                          {row.pendingCount ? "—" : money(row.profit.THB)}
                        </td>
                        <td className={resultClass(row.profit.LAK)}>
                          {row.pendingCount ? "—" : money(row.profit.LAK)}
                        </td>
                        <td className={resultClass(row.profitTHB)}>
                          {row.pendingCount ? "—" : money(row.profitTHB)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="daily-pending-note">
                ยอดรับที่ยังรอผล: {pair(day.pendingReceived)}
              </div>
            </div>
          </details>
        ))}
      </div>
      {!visible.length && (
        <p className="daily-empty">ไม่มีโพยที่ยังใช้งานในช่วงวันที่เลือก</p>
      )}
    </section>
  );
}
