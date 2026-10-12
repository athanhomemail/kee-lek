import React, { useState } from "react";
import { labels } from "./keying.js";
import {
  drawBills,
  reportTypes,
  reportGroups,
  numberExposure,
  resultScenario,
  convertedDrawTotals,
} from "./reports.js";
import WinningReport from "./WinningReport.jsx";
import { resultColumns } from "./draws.js";

const money = (n) =>
  n == null
    ? "—"
    : Number(n).toLocaleString("th-TH", { maximumFractionDigits: 2 });
const date = (d) => String(d).slice(0, 10).split("-").reverse().join("/");
const pair = (v) => (
  <span className="report-amounts">
    <span>{money(v.THB)} บาท</span>
    <span>{money(v.LAK)} K กีบ</span>
  </span>
);

export default function DrawReports({ state, bills }) {
  const [drawId, setDrawId] = useState("");
  const [lotteryId, setLotteryId] = useState("");
  const [tab, setTab] = useState("numbers");
  const [currency, setCurrency] = useState("THB");
  const [type, setType] = useState("");
  const [sort, setSort] = useState("payout");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState({ top3: "", top2: "", bottom2: "" });
  const [simulation, setSimulation] = useState(null);
  const draws = [...state.draws].sort(
    (a, b) =>
      String(b.draw_date).localeCompare(String(a.draw_date)) || b.id - a.id,
  );
  const candidates = resultColumns(state.draws, state.lotteries)
    .map((c) => c.current)
    .filter(Boolean);
  const initial =
    candidates.find((d) => drawBills(bills, d.id).length) ||
    candidates[0] ||
    draws[0];
  const lottery =
    state.lotteries.find((l) => String(l.id) === lotteryId) ||
    state.lotteries.find((l) => l.id === initial?.lottery_id) ||
    state.lotteries[0];
  const lotteryDraws = draws.filter((d) => d.lottery_id === lottery?.id);
  const defaultDraw =
    candidates.find((d) => d.lottery_id === lottery?.id) || lotteryDraws[0];
  const draw = lotteryDraws.find((d) => String(d.id) === drawId) || defaultDraw;
  const selected = drawBills(bills, draw?.id);
  const groups = reportGroups(
    bills,
    draw?.id,
    "type",
    [],
    state.exchangeRates || [],
  );
  const purchased = groups.reduce(
    (s, r) => ({ THB: s.THB + r.THB, LAK: s.LAK + r.LAK }),
    { THB: 0, LAK: 0 },
  );
  const published =
    draw?.top3 &&
    draw?.top2 &&
    draw?.bottom2 &&
    Date.now() >= new Date(draw.result_at).getTime();
  const actual = published ? resultScenario(bills, draw.id, draw) : null;
  const simulated = simulation
    ? resultScenario(bills, draw?.id, simulation)
    : null;
  const converted = convertedDrawTotals(
    bills,
    draw?.id,
    state.exchangeRates || [],
  );
  const allExposures = numberExposure(bills, draw?.id, currency);
  const highest = [...allExposures].sort((a, b) => b.payout - a.payout)[0];
  const overRevenue = allExposures.filter(
    (r) => r.payout > purchased[currency],
  );
  const exposures = allExposures
    .filter((r) => (!type || r.type === type) && r.number.includes(search))
    .sort((a, b) => b[sort] - a[sort] || a.number.localeCompare(b.number));
  const members = reportGroups(
    bills,
    draw?.id,
    "member",
    state.users,
    state.exchangeRates || [],
  );
  const unit = currency === "THB" ? "บาท" : "K กีบ";
  const resultTable = (report) => (
    <div className="report-table-scroll">
      <table className="report-table">
        <thead>
          <tr>
            <th>ประเภทเลข</th>
            <th>ยอดจ่าย (บาท)</th>
            <th>ยอดจ่าย (K กีบ)</th>
          </tr>
        </thead>
        <tbody>
          {reportTypes.map((t) => (
            <tr key={t}>
              <th>{labels[t]}</th>
              <td>{money(report.payout[t].THB)}</td>
              <td>{money(report.payout[t].LAK)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th>ยอดจ่ายรวม</th>
            <th>{money(report.paid.THB)}</th>
            <th>{money(report.paid.LAK)}</th>
          </tr>
          <tr>
            <th>ยอดซื้อรวม − ยอดจ่ายรวม</th>
            <th
              className={
                report.profit.THB < 0 ? "report-loss" : "report-profit"
              }
            >
              {money(report.profit.THB)}
            </th>
            <th
              className={
                report.profit.LAK < 0 ? "report-loss" : "report-profit"
              }
            >
              {money(report.profit.LAK)}
            </th>
          </tr>
        </tfoot>
      </table>
    </div>
  );
  return (
    <section className="panel draw-reports risk-report">
      <div className="report-heading">
        <div>
          <span className="report-eyebrow">รายงานและสถิติ</span>
          <h2>เฝ้าดูความเสี่ยงประจำงวด</h2>
          <p className="muted">ใช้โพยที่ยังใช้งานในงวดนี้ ไม่รวมโพยที่ยกเลิก</p>
        </div>
        <span className="report-status">
          {published ? "ออกผลแล้ว" : "ยังไม่ออกผล"}
        </span>
      </div>
      <div className="report-tabs" role="tablist">
        {[
          ["numbers", "ความเสี่ยง / เลขที่ต้องเฝ้าดู"],
          ["actual", "ยอดจริงในงวด"],
          ["winners", "บิลที่ถูกรางวัล"],
          ["simulation", "ลองใส่ผลหวย"],
          ["member", "ยอดซื้อรายสมาชิก"],
        ].map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="report-draw-picker risk-draw-picker">
        <label>
          1. ประเภทหวย
          <select
            value={lottery?.id || ""}
            onChange={(e) => {
              setLotteryId(e.target.value);
              setDrawId("");
              setSimulation(null);
              setDraft({ top3: "", top2: "", bottom2: "" });
            }}
          >
            {!state.lotteries.length && (
              <option value="">ไม่มีประเภทหวย</option>
            )}
            {state.lotteries.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          2. งวด
          <select
            value={draw?.id || ""}
            onChange={(e) => {
              setDrawId(e.target.value);
              setSimulation(null);
              setDraft({ top3: "", top2: "", bottom2: "" });
            }}
          >
            {!lotteryDraws.length && <option value="">ยังไม่มีงวด</option>}
            {lotteryDraws.map((d) => (
              <option key={d.id} value={d.id}>
                {date(d.draw_date)}
              </option>
            ))}
          </select>
        </label>
        <span className="risk-picker-note">
          รายงานทั้งหมดด้านล่างใช้ {lottery?.name || "—"} · งวด{" "}
          {draw ? date(draw.draw_date) : "—"}
        </span>
      </div>
      {tab !== "numbers" && (
        <>
          <div className="report-metrics">
            <div>
              <span>ยอดซื้อรวมจริง</span>
              <strong>{pair(purchased)}</strong>
              <span>รวมเป็นบาท: {money(converted.totalTHB)}</span>
            </div>
            <div>
              <span>โพยที่ใช้งานจริง</span>
              <strong>{selected.length} โพย</strong>
            </div>
            <div>
              <span>เงินรางวัลตามผลจริง</span>
              <strong>{actual ? pair(actual.paid) : "ยังไม่ออกผล"}</strong>
            </div>
            <div>
              <span>กำไร / ขาดทุนตามผลจริง</span>
              <strong>{actual ? pair(actual.profit) : "ยังไม่ออกผล"}</strong>
            </div>
          </div>
          <p className="report-exchange-note">
            ยอดซื้อรวมคือเงินที่สมาชิกซื้อทั้งหมด แสดงเพียงยอดเดียว · 1 K =
            1,000 กีบ · ยอดรวมเป็นบาทใช้อัตราแลกเปลี่ยนล่าสุดที่ Leader ตั้งไว้
          </p>
        </>
      )}
      <div className="report-tab-content" role="tabpanel">
        {!draw ? (
          <p>ยังไม่มีงวดหวย</p>
        ) : tab === "numbers" ? (
          <>
            <div className="risk-section-title">
              <div>
                <span className="risk-kicker">
                  ภาระจ่ายหากเลขถูก · ดูได้ก่อนออกผล
                </span>
                <h3>เลขไหนต้องเฝ้าดูมากที่สุด</h3>
              </div>
              <span className="risk-live">อัปเดตเมื่อมีโพยใหม่</span>
            </div>
            <div className="risk-cards">
              <div className="risk-card risk-card-danger">
                <span>เลขที่มีภาระจ่ายสูงสุด · {unit}</span>
                <strong>
                  {highest
                    ? `${highest.number} · ${labels[highest.type]}`
                    : "ยังไม่มีรายการซื้อ"}
                </strong>
                <b>{highest ? `${money(highest.payout)} ${unit}` : "—"}</b>
                <small>เงินที่ต้องจ่ายเฉพาะเลขและประเภทนี้</small>
              </div>
              <div className="risk-card">
                <span>ยอดซื้อรวมของงวด · {unit}</span>
                <strong>
                  {money(purchased[currency])} <small>{unit}</small>
                </strong>
                <small>ยอดเงินจริงทุกประเภท ก่อนจ่ายรางวัล</small>
              </div>
              <div className="risk-card risk-card-warning">
                <span>เลขที่จ่ายเกินยอดซื้อทั้งงวด</span>
                <strong>
                  {overRevenue.length} <small>เลข / ประเภท</small>
                </strong>
                <small>เฉพาะภาระของเลขนั้นก็เกินยอดซื้อรวมแล้ว</small>
              </div>
            </div>
            <div className="risk-filter-title">
              กรองตารางความเสี่ยง{" "}
              <small>
                ประเภทเลขและคำค้นใช้เฉพาะตาราง · สกุลเงินใช้ทั้งการ์ดและตาราง
              </small>
            </div>
            <div className="toolbar report-controls">
              <label>
                สกุลเงิน
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="THB">บาท</option>
                  <option value="LAK">K กีบ</option>
                </select>
              </label>
              <label>
                ประเภทเลข
                <select value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="">ทุกประเภท</option>
                  {reportTypes.map((t) => (
                    <option key={t} value={t}>
                      {labels[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                ค้นหาเลข
                <input
                  inputMode="numeric"
                  value={search}
                  onChange={(e) => setSearch(e.target.value.replace(/\D/g, ""))}
                  placeholder="เช่น 12"
                />
              </label>
              <label>
                เรียงมากที่สุดก่อน
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="payout">เงินที่ต้องจ่ายหากถูก</option>
                  <option value="amount">ยอดเงินซื้อ</option>
                  <option value="count">จำนวนรายการซื้อ</option>
                </select>
              </label>
            </div>
            <p className="muted">
              เลขโต๊ดที่สลับหลักกันรวมเป็นชุดเดียว เพราะถูกพร้อมกัน
            </p>
            <div className="report-table-scroll">
              <table className="report-table risk-table">
                <thead>
                  <tr>
                    <th>อันดับ</th>
                    <th>เลขที่ซื้อ</th>
                    <th>ประเภทเลข</th>
                    <th className="risk-payout-cell">
                      ต้องจ่ายหากถูก ({unit})
                    </th>
                    <th>ยอดซื้อเลขนี้ ({unit})</th>
                    <th>รายการซื้อ</th>
                    <th>จ่ายเกินยอดซื้อทั้งงวด ({unit})</th>
                  </tr>
                </thead>
                <tbody>
                  {exposures.map((r, index) => (
                    <tr
                      key={r.key}
                      className={
                        r.payout > purchased[currency] ? "risk-row-danger" : ""
                      }
                    >
                      <td>{index + 1}</td>
                      <td>
                        <strong className="risk-number">{r.number}</strong>
                      </td>
                      <td>{labels[r.type]}</td>
                      <td className="risk-payout-cell">{money(r.payout)}</td>
                      <td>{money(r.amount)}</td>
                      <td>{r.count}</td>
                      <td
                        className={
                          r.payout > purchased[currency] ? "report-loss" : ""
                        }
                      >
                        {money(Math.max(0, r.payout - purchased[currency]))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!exposures.length && (
              <div className="risk-empty">
                <strong>
                  {allExposures.length
                    ? "ไม่พบเลขตามตัวกรอง"
                    : `ยังไม่มีรายการซื้อ${unit}ในงวดนี้`}
                </strong>
                <p>
                  {allExposures.length
                    ? "ลองเปลี่ยนประเภทเลขหรือคำค้นหา"
                    : "เมื่อสมาชิกส่งโพย เลขและภาระจ่ายจะปรากฏที่นี่"}
                </p>
              </div>
            )}
            <p className="muted">
              จ่ายเกินยอดซื้อทั้งงวด = เงินรางวัลของเลขนี้ −
              ยอดซื้อรวมทุกประเภทในสกุลเงินเดียวกัน (ถ้าไม่เกินแสดง 0)
              ผลจริงอาจต้องจ่ายเลขประเภทอื่นร่วมด้วย
            </p>
          </>
        ) : tab === "winners" ? (
          <WinningReport key={draw.id} bills={bills} draw={draw} />
        ) : tab === "actual" ? (
          <>
            <h3>ยอดซื้อจริงแยกประเภทเลข</h3>
            <div className="report-table-scroll">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>ประเภทเลข</th>
                    <th>ยอดซื้อ (บาท)</th>
                    <th>ยอดซื้อ (K กีบ)</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((r) => (
                    <tr key={r.key}>
                      <th>{labels[r.key]}</th>
                      <td>{money(r.THB)}</td>
                      <td>{money(r.LAK)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th>ยอดซื้อรวม</th>
                    <th>{money(purchased.THB)}</th>
                    <th>{money(purchased.LAK)}</th>
                  </tr>
                </tfoot>
              </table>
            </div>
            <h3>เงินรางวัลและกำไรตามผลจริง</h3>
            {actual ? (
              <>
                <p>
                  ผลจริง: 3 ตัวบน {draw.top3} · 2 ตัวบน {draw.top2} · 2 ตัวล่าง{" "}
                  {draw.bottom2}
                </p>
                {resultTable(actual)}
              </>
            ) : (
              <p className="muted">
                ยังไม่ออกผล จึงยังไม่มีเงินรางวัลและกำไรตามผลจริง
              </p>
            )}
          </>
        ) : tab === "simulation" ? (
          <>
            <h3>ถ้าผลออกเลขที่กรอก จะต้องจ่ายเท่าไร</h3>
            <p className="muted">
              ใช้ได้ก่อนออกผล กรอกผลที่อยากลองทั้งสามช่อง แล้วกดคำนวณ
              เป็นเพียงการสมมุติ ไม่บันทึกหรือเปลี่ยนผลหวยจริง
            </p>
            <form
              className="admin-edit-form"
              onSubmit={(e) => {
                e.preventDefault();
                setSimulation({ ...draft });
              }}
            >
              <div className="admin-result-inputs">
                {[
                  ["top3", "สมมุติ 3 ตัวบน", 3],
                  ["top2", "สมมุติ 2 ตัวบน", 2],
                  ["bottom2", "สมมุติ 2 ตัวล่าง", 2],
                ].map(([key, label, size]) => (
                  <label key={key}>
                    {label}
                    <input
                      required
                      inputMode="numeric"
                      pattern={`[0-9]{${size}}`}
                      maxLength={size}
                      placeholder={"0".repeat(size)}
                      value={draft[key]}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "");
                        setDraft((d) => ({
                          ...d,
                          [key]: v,
                          ...(key === "top3" && v.length === 3
                            ? { top2: v.slice(-2) }
                            : {}),
                        }));
                        setSimulation(null);
                      }}
                    />
                  </label>
                ))}
              </div>
              <button className="primary">คำนวณยอดจ่ายจากผลสมมุติ</button>
            </form>
            {simulated && (
              <>
                <h3>
                  ผลสมมุติ: {simulation.top3} / {simulation.top2} /{" "}
                  {simulation.bottom2}
                </h3>
                <p className="muted">
                  ยอดซื้อจริงทั้งงวด {pair(purchased)} · ถูก {simulated.count}{" "}
                  รายการ · เงินรางวัลใช้ยอดซื้อคูณอัตราจ่ายของแต่ละรายการ
                </p>
                {resultTable(simulated)}
                <p className="muted">
                  ค่าบวกคือกำไร ค่าลบคือขาดทุน ก่อนค่าใช้จ่ายอื่น
                </p>
              </>
            )}
          </>
        ) : (
          <>
            <h3>ยอดซื้อจริงรายสมาชิก</h3>
            <div className="report-table-scroll">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>สมาชิก</th>
                    <th>ยอดซื้อ (บาท)</th>
                    <th>ยอดซื้อ (K กีบ)</th>
                    <th>กีบแปลงเป็นบาท</th>
                    <th>รวมเป็นบาท</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((r) => (
                    <tr key={r.key}>
                      <td>{r.name}</td>
                      <td>{money(r.THB)}</td>
                      <td>{money(r.LAK)}</td>
                      <td>{money(r.lakInTHB)}</td>
                      <td>{money(r.totalTHB)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
