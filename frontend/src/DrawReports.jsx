import BillCard from "./BillCard.jsx";
import BillPages from "./BillPages.jsx";
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
import DailyPerformance from "./DailyPerformance.jsx";
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
  const [billMember, setBillMember] = useState("");
  const [billCurrency, setBillCurrency] = useState("ALL");
  const [tab, setTab] = useState("numbers");
  const [currency, setCurrency] = useState("THB");
  const [type, setType] = useState("");
  const [sort, setSort] = useState("payout");
  const [search, setSearch] = useState("");
  const [limits, setLimits] = useState({ THB: "", LAK: "" });
  const [onlyOverLimit, setOnlyOverLimit] = useState(false);
  const limit = limits[currency] === "" ? null : Number(limits[currency]);
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
  const exposures = allExposures
    .filter(
      (r) =>
        (!type || r.type === type) &&
        r.number.includes(search) &&
        (!onlyOverLimit || limit === null || r.payout > limit),
    )
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
          ["bills", "บิลและส่วนลด"],
          ["simulation", "ลองใส่ผลหวย"],
          ["member", "ยอดซื้อรายสมาชิก"],
          ...(state.user.role === "Leader"
            ? [["daily", "สรุปผลประกอบการรายวัน"]]
            : []),
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
      {tab !== "daily" && (
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
      )}
      {tab !== "numbers" && tab !== "daily" && (
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
        {tab === "daily" ? (
          <DailyPerformance state={state} />
        ) : !draw ? (
          <p>ยังไม่มีงวดหวย</p>
        ) : tab === "bills" ? (
          <>
            <h3>ยอดเรียกเก็บและส่วนลดรายบิล</h3>
            <p>
              ยอดส่วนลดเป็นข้อมูลประกอบการตกลงกับลูกค้า
              โดยยอดขายและเงินรางวัลยังใช้ยอดเต็ม
            </p>
            <div className="toolbar">
              <label>
                สกุลเงิน
                <select
                  value={billCurrency}
                  onChange={(e) => setBillCurrency(e.target.value)}
                >
                  <option value="ALL">บาทและกีบ</option>
                  <option value="THB">บาท</option>
                  <option value="LAK">K กีบ</option>
                </select>
              </label>
              {state.user.role !== "Member" && (
                <label>
                  สมาชิก
                  <select
                    value={billMember}
                    onChange={(e) => setBillMember(e.target.value)}
                  >
                    <option value="">ทุกคน</option>
                    {[
                      ...new Map(
                        selected.map((b) => [
                          String(b.member_id),
                          b.member_name,
                        ]),
                      ).entries(),
                    ].map(([id, name]) => (
                      <option key={id} value={id}>
                        {name || `สมาชิก #${id}`}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <BillPages
              key={`${draw.id}-${billCurrency}-${billMember}`}
              bills={selected
                .filter(
                  (b) =>
                    (!billMember || String(b.member_id) === billMember) &&
                    (billCurrency === "ALL" ||
                      (b.currency || b.items?.[0]?.currency || "THB") ===
                        billCurrency),
                )
                .slice()
                .sort((a, b) => b.id - a.id)}
              renderBill={(b) => <BillCard key={b.id} b={b} state={state} />}
              empty={<p>ไม่มีบิลตามตัวกรอง</p>}
            />
          </>
        ) : tab === "numbers" ? (
          <>
            <div className="risk-filter-title">
              กรองตารางความเสี่ยง{" "}
              <small>
                กรอกวงเงินที่รับได้ เพื่อดูส่วนต่างและเลขที่ต้องจ่ายเกินวงเงิน
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
              <label>
                วงเงินที่รับได้ ({unit})
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={limits[currency]}
                  placeholder="เช่น 100000"
                  onChange={(e) => {
                    const value = e.target.value;
                    if (
                      value === "" ||
                      (Number.isFinite(Number(value)) && Number(value) >= 0)
                    )
                      setLimits((current) => ({
                        ...current,
                        [currency]: value,
                      }));
                  }}
                />
              </label>
              <label>
                แสดงรายการ
                <select
                  value={onlyOverLimit ? "over" : "all"}
                  onChange={(e) => setOnlyOverLimit(e.target.value === "over")}
                  disabled={limit === null}
                >
                  <option value="all">ทุกเลข</option>
                  <option value="over">เฉพาะเลขที่เกินวงเงิน</option>
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
                    <th>วงเงิน − ต้องจ่ายหากถูก ({unit})</th>
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
                        (
                          limit === null
                            ? r.payout > purchased[currency]
                            : r.payout > limit
                        )
                          ? "risk-row-danger"
                          : ""
                      }
                    >
                      <td>{index + 1}</td>
                      <td>
                        <strong className="risk-number">{r.number}</strong>
                      </td>
                      <td>{labels[r.type]}</td>
                      <td className="risk-payout-cell">{money(r.payout)}</td>
                      <td
                        className={
                          limit !== null && r.payout > limit
                            ? "report-loss"
                            : ""
                        }
                      >
                        {limit === null
                          ? "—"
                          : money(Math.round((limit - r.payout) * 100) / 100)}
                      </td>
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
                    ? "ลองเปลี่ยนประเภทเลข คำค้นหา หรือวงเงิน"
                    : "เมื่อสมาชิกส่งโพย เลขและภาระจ่ายจะปรากฏที่นี่"}
                </p>
              </div>
            )}
            <p className="muted">
              ส่วนต่างวงเงิน = วงเงินที่รับได้ − ต้องจ่ายหากถูก ·
              ค่าติดลบคือจำนวนที่เกินวงเงิน เช่น วงเงิน 100,000 ต้องจ่าย 120,000
              แสดง −20,000
            </p>
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
