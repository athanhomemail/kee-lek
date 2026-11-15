import { useBillData } from "./useBillData.js";
import MemberCollectionReport from "./MemberCollectionReport.jsx";
import { sortLotteries } from "./lotteryOrder.js";
import LotteryOptions from "./LotteryOptions.jsx";
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

export default function DrawReports({ state, api }) {
  const lotteries = sortLotteries(state.lotteries);
  const [drawId, setDrawId] = useState("");
  const [lotteryId, setLotteryId] = useState("");
  const [billMember, setBillMember] = useState("");
  const [billCurrency, setBillCurrency] = useState("ALL");
  const [tab, setTab] = useState("numbers");
  const [type, setType] = useState("");
  const [sort, setSort] = useState("payout");
  const [search, setSearch] = useState("");
  const [limits, setLimits] = useState({ THB: "", LAK: "" });
  const [draft, setDraft] = useState({ top3: "", top2: "", bottom2: "" });
  const [simulation, setSimulation] = useState(null);
  const draws = [...state.draws].sort(
    (a, b) =>
      String(b.draw_date).localeCompare(String(a.draw_date)) || b.id - a.id,
  );
  const candidates = resultColumns(state.draws, lotteries)
    .map((c) => c.current)
    .filter(Boolean);
  const lottery =
    lotteries.find((l) => String(l.id) === lotteryId) || lotteries[0];
  const lotteryDraws = draws.filter((d) => d.lottery_id === lottery?.id);
  const defaultDraw =
    candidates.find((d) => d.lottery_id === lottery?.id) || lotteryDraws[0];
  const draw = lotteryDraws.find((d) => String(d.id) === drawId) || defaultDraw;
  const report = useBillData(
    api,
    state.user,
    { draw: draw?.id },
    Boolean(draw && tab !== "daily"),
  );
  const { bills } = report;
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
  const members = reportGroups(
    bills,
    draw?.id,
    "member",
    state.users,
    state.exchangeRates || [],
  );
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
              {!lotteries.length && <option value="">ไม่มีประเภทหวย</option>}
              <LotteryOptions items={lotteries} />
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
          <DailyPerformance state={state} api={api} />
        ) : report.loading || report.error ? (
          <p role="status">
            {report.error ? "โหลดรายงานไม่สำเร็จ" : "กำลังโหลดรายงาน…"}
          </p>
        ) : !draw ? (
          <p>ยังไม่มีงวดหวย</p>
        ) : tab === "bills" && state.user.role === "Leader" ? (
          <MemberCollectionReport
            key={draw.id}
            state={state}
            bills={bills}
            draw={draw}
          />
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
            <div className="toolbar report-controls risk-filters">
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
              {["THB", "LAK"].map((currency) => (
                <label key={currency}>
                  วงเงิน ({currency === "THB" ? "บาท" : "K กีบ"})
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={limits[currency]}
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
              ))}
            </div>
            <p className="muted">
              เลขโต๊ดที่สลับหลักกันรวมเป็นชุดเดียว เพราะถูกพร้อมกัน
            </p>
            <div className="risk-tables">
              {["THB", "LAK"].map((currency) => {
                const unit = currency === "THB" ? "บาท" : "K กีบ";
                const limit =
                  limits[currency] === "" ? null : Number(limits[currency]);
                const all = numberExposure(bills, draw.id, currency);
                const rows = all
                  .filter(
                    (r) =>
                      (!type || r.type === type) && r.number.includes(search),
                  )
                  .sort(
                    (a, b) =>
                      b[sort] - a[sort] || a.number.localeCompare(b.number),
                  );
                return (
                  <section key={currency} className="risk-currency">
                    <h3>{currency === "THB" ? "เงินบาท" : "เงินกีบ (K)"}</h3>
                    <div className="report-table-scroll">
                      <table
                        className="report-table risk-table"
                        aria-label={`ตารางความเสี่ยง (${unit})`}
                      >
                        <thead>
                          <tr>
                            <th>อันดับ</th>
                            <th>เลข</th>
                            <th>ประเภท</th>
                            <th>ต้องจ่ายหากถูก</th>
                            <th>ยอดซื้อเลขนี้</th>
                            <th>จ่ายเกินยอดซื้อทั้งงวด</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r, index) => (
                            <tr
                              key={r.key}
                              className={
                                r.payout > (limit ?? purchased[currency])
                                  ? "risk-row-danger"
                                  : ""
                              }
                            >
                              <td>{index + 1}</td>
                              <td>
                                <strong className="risk-number">
                                  {r.number}
                                </strong>
                              </td>
                              <td>{labels[r.type]}</td>
                              <td className="risk-payout-cell">
                                {money(r.payout)}
                                <small
                                  className={
                                    limit !== null && r.payout > limit
                                      ? "report-loss"
                                      : ""
                                  }
                                >
                                  ส่วนต่าง{" "}
                                  {limit === null
                                    ? "—"
                                    : money(
                                        Math.round((limit - r.payout) * 100) /
                                          100,
                                      )}
                                </small>
                              </td>
                              <td>
                                {money(r.amount)}
                                <small>{r.count} รายการ</small>
                              </td>
                              <td
                                className={
                                  r.payout > purchased[currency]
                                    ? "report-loss"
                                    : ""
                                }
                              >
                                {money(
                                  Math.max(0, r.payout - purchased[currency]),
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!rows.length && (
                      <p className="risk-empty">
                        {all.length
                          ? "ไม่พบเลขตามตัวกรอง"
                          : `ยังไม่มีรายการซื้อ (${unit})`}
                      </p>
                    )}
                  </section>
                );
              })}
            </div>
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
