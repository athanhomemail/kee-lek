import React, { useMemo, useState } from "react";
import {
  ChartNoAxesCombined,
  Users,
  Layers,
  ArrowDownWideNarrow,
  ReceiptText,
} from "lucide-react";
import { labels } from "./keying.js";
import { forecastReport, reportGroups, reportTypes } from "./reports.js";

const money = (value) =>
  Number(value).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const date = (value) =>
  String(value).slice(0, 10).split("-").reverse().join("-");
const pair = (value) => (
  <span className="report-amounts">
    <span>{money(value.THB)} บาท</span>
    <span>{money(value.LAK)} K กีบ</span>
  </span>
);

export default function DrawReports({ state, bills }) {
  const [drawId, setDrawId] = useState("");
  const [tab, setTab] = useState("forecast");
  const [side, setSide] = useState("top");
  const [fixed, setFixed] = useState(null);
  const [limit, setLimit] = useState("50");
  const [sort, setSort] = useState("count");
  const [group, setGroup] = useState("member");
  const [exchange, setExchange] = useState("");
  const [tableCurrency, setTableCurrency] = useState("THB");
  const draws = [...state.draws].sort(
    (a, b) =>
      String(b.draw_date).localeCompare(String(a.draw_date)) || b.id - a.id,
  );
  const draw = draws.find((d) => String(d.id) === drawId) || draws[0];
  const fixedDefault =
    side === "top" ? draw?.bottom2 || "00" : draw?.top3 || "000";
  const fixedInput = fixed ?? fixedDefault;
  const fixedResult = fixedInput.padStart(side === "top" ? 2 : 3, "0");
  const forecast = useMemo(
    () => forecastReport(bills, draw?.id, side, fixedResult),
    [bills, draw?.id, side, fixedResult],
  );
  const groups = useMemo(
    () => reportGroups(bills, draw?.id, group, state.users),
    [bills, draw?.id, group, state.users],
  );
  const rows = [...forecast.rows].sort(
    (a, b) => a[sort] - b[sort] || a.number.localeCompare(b.number),
  );
  const visible = limit === "all" ? rows : rows.slice(0, Number(limit));
  const exchangeRate = Number(exchange);
  const combined = (row) =>
    row.LAK === 0
      ? money(row.THB)
      : exchangeRate > 0 && Number.isFinite(exchangeRate)
        ? money(row.THB + row.LAK / exchangeRate)
        : "—";
  const total = groups.reduce(
    (sum, row) => ({ THB: sum.THB + row.THB, LAK: sum.LAK + row.LAK }),
    { THB: 0, LAK: 0 },
  );
  const actual = useMemo(
    () =>
      draw?.top3 && draw?.bottom2
        ? forecastReport(bills, draw.id, "top", draw.bottom2).rows.find(
            (r) => r.top3 === draw.top3,
          )
        : null,
    [bills, draw?.id, draw?.top3, draw?.bottom2],
  );
  const resultCell = (value) => (
    <td
      className={value < 0 ? "report-loss" : value > 0 ? "report-profit" : ""}
    >
      {money(value)}
    </td>
  );
  const cellAmount = (value) => money(value[tableCurrency]);
  const selectedBills = bills.filter(
    (b) => b.status === "active" && String(b.draw_id) === String(draw?.id),
  );
  return (
    <section className="panel draw-reports">
      <div className="report-heading">
        <div>
          <span className="report-eyebrow">รายงานและสถิติ</span>
          <h2>ภาพรวมประจำงวด</h2>
          <p className="muted">ตรวจยอดซื้อและประเมินผลกำไร–ขาดทุนในที่เดียว</p>
        </div>
        <span className={"report-status " + (actual ? "is-result" : "")}>
          {actual ? "ออกผลแล้ว" : "รอออกผล"}
        </span>
      </div>
      <div className="report-draw-picker">
        <label>
          หวย / งวด
          <select
            aria-label="หวยและงวดรายงาน"
            value={draw?.id || ""}
            onChange={(e) => {
              setDrawId(e.target.value);
              setFixed(null);
            }}
          >
            {!draws.length && <option value="">ไม่มีงวดหวย</option>}
            {draws.map((d) => (
              <option key={d.id} value={d.id}>
                [
                {d.kind === "foreign" || d.kind === "หวยนอก"
                  ? "หวยต่างประเทศ"
                  : d.kind === "thai"
                    ? "หวยไทย"
                    : d.kind || "หวย"}
                ] {d.name} , {date(d.draw_date)}
              </option>
            ))}
          </select>
        </label>
        <div className="report-selected-draw">
          <ReceiptText size={18} />
          <div>
            <strong>{draw?.name || "ยังไม่มีงวด"}</strong>
            <span>งวด {draw ? date(draw.draw_date) : "—"}</span>
          </div>
        </div>
      </div>
      <div className="report-metrics">
        <div>
          <span>ยอดซื้อในงวด</span>
          <strong>{pair(forecast.received)}</strong>
        </div>
        <div>
          <span>โพยที่ใช้งาน</span>
          <strong>
            {selectedBills.length.toLocaleString("th-TH")} <small>โพย</small>
          </strong>
        </div>
        <div>
          <span>ยอดจ่ายตามผลจริง</span>
          <strong>{actual ? pair(actual.paid) : "รอออกผล"}</strong>
        </div>
        <div>
          <span>กำไร / ขาดทุนตามผลจริง</span>
          <strong>
            {actual ? pair({ THB: actual.THB, LAK: actual.LAK }) : "—"}
          </strong>
        </div>
      </div>
      <div className="report-tabs" role="tablist" aria-label="ประเภทรายงาน">
        {[
          ["forecast", "คาดการณ์กำไร–ขาดทุน", ChartNoAxesCombined],
          ["member", "รายงานสมาชิก", Users],
          ["type", "ประเภทหวย", Layers],
        ].map(([key, title, Icon]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? "active" : ""}
            onClick={() => {
              setTab(key);
              if (key !== "forecast") setGroup(key);
            }}
          >
            <Icon size={17} />
            {title}
          </button>
        ))}
      </div>
      <div
        className="report-tab-content"
        role="tabpanel"
        aria-label={
          tab === "forecast"
            ? "คาดการณ์กำไร–ขาดทุน"
            : tab === "member"
              ? "รายงานสมาชิก"
              : "ประเภทหวย"
        }
      >
        {!draw ? (
          <p className="muted">ไม่มีงวดหวยสำหรับรายงาน</p>
        ) : tab === "forecast" ? (
          <>
            <div className="toolbar report-controls">
              <label>
                แสดงเลข
                <select
                  value={side}
                  onChange={(e) => {
                    setSide(e.target.value);
                    setFixed(null);
                  }}
                >
                  <option value="top">เลขบน (000–999)</option>
                  <option value="bottom">เลขล่าง (00–99)</option>
                </select>
              </label>
              <label>
                {side === "top" ? "กำหนดเลข 2 ตัวล่าง" : "กำหนดเลข 3 ตัวบน"}
                <input
                  aria-label="เลขผลอีกฝั่งสำหรับคาดการณ์"
                  inputMode="numeric"
                  maxLength={side === "top" ? 2 : 3}
                  value={fixedInput}
                  onChange={(e) => {
                    const size = side === "top" ? 2 : 3;
                    const v = e.target.value;
                    if (/^\d*$/.test(v) && v.length <= size) setFixed(v);
                  }}
                  onBlur={() =>
                    setFixed(fixedResult.padStart(side === "top" ? 2 : 3, "0"))
                  }
                />
              </label>
              <label>
                จำนวนแถว
                <select
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                >
                  {[50, 250, 500, 750].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                  <option value="all">ทั้งหมด</option>
                </select>
              </label>
              <label>
                เรียงจากน้อยไปมาก
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="count">จำนวนถูก (รวม)</option>
                  <option value="THB">กำไร/ขาดทุน (บาท)</option>
                  <option value="LAK">กำไร/ขาดทุน (กีบ)</option>
                </select>
              </label>
            </div>
            <div className="report-table-currency">
              <span>สกุลเงินในตาราง</span>
              <div className="report-segment">
                {["THB", "LAK"].map((c) => (
                  <button
                    type="button"
                    key={c}
                    aria-pressed={tableCurrency === c}
                    className={tableCurrency === c ? "active" : ""}
                    onClick={() => setTableCurrency(c)}
                  >
                    {c === "THB" ? "บาท" : "K กีบ"}
                  </button>
                ))}
              </div>
            </div>
            <details className="report-explanation">
              <summary>วิธีอ่านรายงานและเงื่อนไขคาดการณ์</summary>
              <p className="muted">
                กำไร/ขาดทุน = ยอดรับ − ยอดจ่ายตามอัตราของรายการซื้อ ·
                จำนวนถูกนับเป็นรายการ · เงินกีบใช้หน่วย K (1 K = 1,000 กีบ)
              </p>
              <p className="muted">
                คาดการณ์เลข
                {side === "top" ? "บนโดยคงเลขล่าง" : "ล่างโดยคงเลขบน"}
                ไว้ที่ {fixedResult} · ยอดตีออกยังไม่มีข้อมูลในระบบ
              </p>
            </details>
            <div className="report-section-heading">
              <h3>สรุปยอดในงวด</h3>
              <span>ยอดตีออกยังไม่มีข้อมูล</span>
            </div>
            <div className="report-table-scroll report-summary-table">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>ผลรวม / ออกผล</th>
                    {reportTypes.map((t) => (
                      <th key={t}>{labels[t]}</th>
                    ))}
                    <th>จำนวนถูก (รวม)</th>
                    <th>กำไร/ขาดทุน (บาท)</th>
                    <th>กำไร/ขาดทุน (K กีบ)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th>ยอดซื้อ</th>
                    {reportTypes.map((t) => (
                      <td key={t}>{cellAmount(forecast.purchase[t])}</td>
                    ))}
                    <td>—</td>
                    <td>—</td>
                    <td>—</td>
                  </tr>
                  <tr>
                    <th>ยอดรับ</th>
                    <td colSpan={6}>{cellAmount(forecast.received)}</td>
                    <td>—</td>
                    <td>—</td>
                    <td>—</td>
                  </tr>
                  <tr>
                    <th>
                      ยอดจ่าย{" "}
                      {actual
                        ? `(ผล ${draw.top3} / ${draw.bottom2})`
                        : "(รอออกผล)"}
                    </th>
                    {reportTypes.map((t) => (
                      <td key={t}>
                        {actual ? cellAmount(actual.payout[t]) : "—"}
                      </td>
                    ))}
                    <td>{actual?.count ?? "—"}</td>
                    {actual ? (
                      <>
                        {resultCell(actual.THB)}
                        {resultCell(actual.LAK)}
                      </>
                    ) : (
                      <>
                        <td>—</td>
                        <td>—</td>
                      </>
                    )}
                  </tr>
                  <tr>
                    <th>ยอดตีออก</th>
                    <td colSpan={9}>ยังไม่มีข้อมูล</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="report-section-heading">
              <div>
                <h3>ผลลัพธ์คาดการณ์</h3>
                <span>
                  คงเลข{side === "top" ? "ล่าง" : "บน"}ที่ {fixedResult} ·
                  ยอดจ่ายแสดงเป็น {tableCurrency === "THB" ? "บาท" : "K กีบ"}
                </span>
              </div>
              <span className="report-row-count">
                <ArrowDownWideNarrow size={14} />
                {visible.length} / {rows.length} แถว
              </span>
            </div>
            <div className="report-table-scroll">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>3 ตัวบน</th>
                    <th>2 ตัวบน</th>
                    <th>2 ตัวล่าง</th>
                    {reportTypes.map((t) => (
                      <th key={t}>ยอดจ่าย {labels[t]}</th>
                    ))}
                    <th>จำนวนถูก (รวม)</th>
                    <th>กำไร/ขาดทุน (บาท)</th>
                    <th>กำไร/ขาดทุน (K กีบ)</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.number}>
                      <td>
                        <strong className="report-number">{r.top3}</strong>
                      </td>
                      <td>{r.top2}</td>
                      <td>{r.bottom2}</td>
                      {reportTypes.map((t) => (
                        <td key={t}>{cellAmount(r.payout[t])}</td>
                      ))}
                      <td>{r.count}</td>
                      {resultCell(r.THB)}
                      {resultCell(r.LAK)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div className="toolbar report-controls">
              <div className="report-group-heading">
                <h3>
                  {group === "member"
                    ? "ยอดซื้อแยกตามสมาชิก"
                    : "ยอดซื้อแยกตามประเภทหวย"}
                </h3>
                <span className="muted">เฉพาะงวดที่เลือก</span>
              </div>
              <label>
                อัตราแลกเปลี่ยน (K กีบ ต่อ 1 บาท)
                <input
                  type="number"
                  min="0.000001"
                  step="any"
                  placeholder="กรอกเพื่อรวมยอดเป็นบาท"
                  value={exchange}
                  onChange={(e) => setExchange(e.target.value)}
                />
              </label>
            </div>
            <p className="muted">
              ยอดซื้อเฉพาะโพยที่ยังใช้งานในงวดนี้ · ยอดรวมเป็นบาท = ยอดบาท + ยอด
              K กีบ ÷ อัตราแลกเปลี่ยนที่กรอก
            </p>
            <div className="report-table-scroll">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>{group === "member" ? "ชื่อสมาชิก" : "ประเภท"}</th>
                    <th>ยอด (K กีบ)</th>
                    <th>ยอด (บาท)</th>
                    <th>ยอดทั้งหมด (บาท)</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((r) => (
                    <tr key={r.key}>
                      <td>{group === "type" ? labels[r.key] : r.name}</td>
                      <td>{money(r.LAK)}</td>
                      <td>{money(r.THB)}</td>
                      <td>{combined(r)}</td>
                    </tr>
                  ))}
                  {!groups.length && (
                    <tr>
                      <td colSpan={4}>ไม่มีรายการซื้อในงวดที่เลือก</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <th>รวม</th>
                    <th>{money(total.LAK)}</th>
                    <th>{money(total.THB)}</th>
                    <th>{combined(total)}</th>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
