import { sortLotteries } from "./lotteryOrder.js";
import LotteryOptions from "./LotteryOptions.jsx";
import React, { useMemo, useState } from "react";
import DrawReports from "./DrawReports.jsx";
import BillCard from "./BillCard.jsx";
import BillPages from "./BillPages.jsx";
import ReportPages from "./ReportPages.jsx";
import { labels } from "./keying.js";
import { currencyTotals, rankedNumbers, reportCurrencyOf } from "./reports.js";
import { historicalSales } from "./historicalSales.js";
const money = (n) =>
  Number(n || 0).toLocaleString("th-TH", { maximumFractionDigits: 2 });
const unit = (c) => (c === "LAK" ? "K กีบ" : "บาท");
const amount = (n, c) => `${money(n)} ${unit(c)}`;
const drawLabel = (d) =>
  String(d.draw_date).slice(0, 10).split("-").reverse().join("/");
export default function Statistics({
  state,
  bills,
  filters,
  historyLotteries,
}) {
  const catalog = historyLotteries || state.lotteries;
  const [open, setOpen] = useState(false),
    [tab, setTab] = useState("ranking");
  const [currency, setCurrency] = useState("ALL"),
    [drawId, setDrawId] = useState("");
  const [rankingLotteryId, setRankingLotteryId] = useState("");
  const [sortCurrency, setSortCurrency] = useState("THB"),
    [direction, setDirection] = useState("desc"),
    [type, setType] = useState("");
  const [billStatus, setBillStatus] = useState(""),
    [billLottery, setBillLottery] = useState("");
  const currencies = currency === "ALL" ? ["THB", "LAK"] : [currency];
  const visible = useMemo(
    () =>
      bills.filter(
        (b) => currency === "ALL" || reportCurrencyOf(b) === currency,
      ),
    [bills, currency],
  );
  const active = useMemo(
    () => visible.filter((b) => b.status === "active"),
    [visible],
  );
  const draws = useMemo(() => {
    const ids = new Set(
      bills.filter((b) => b.status === "active").map((b) => String(b.draw_id)),
    );
    return state.draws
      .filter((d) => ids.has(String(d.id)))
      .slice()
      .sort(
        (a, b) =>
          String(b.draw_date).localeCompare(String(a.draw_date)) || b.id - a.id,
      );
  }, [bills, state.draws]);
  const rankingLotteries = sortLotteries(catalog);
  const rankingLottery =
    rankingLotteries.find((l) => String(l.id) === rankingLotteryId) ||
    rankingLotteries[0];
  const rankingDraws = draws.filter(
    (d) => String(d.lottery_id) === String(rankingLottery?.id),
  );
  const selectedDraw =
    rankingDraws.find((d) => String(d.id) === drawId) || rankingDraws[0];
  const ranking = useMemo(
    () =>
      open && tab === "ranking" && selectedDraw
        ? rankedNumbers(visible, selectedDraw.id, sortCurrency, direction, type)
        : [],
    [open, tab, visible, selectedDraw, sortCurrency, direction, type],
  );
  const sales = useMemo(
    () =>
      open && (tab === "lotteries" || tab === "people")
        ? historicalSales(
            active,
            state.draws,
            catalog,
            state.users,
            state.user.role,
          )
        : { lotteries: [], people: [] },
    [open, tab, active, state.draws, catalog, state.users, state.user.role],
  );
  const drawMap = useMemo(
    () => new Map(state.draws.map((d) => [String(d.id), d])),
    [state.draws],
  );
  const effectiveBillLottery = catalog.some((l) => String(l.id) === billLottery)
    ? billLottery
    : "";
  const historyBills = useMemo(
    () =>
      visible
        .filter(
          (b) =>
            (!billStatus || b.status === billStatus) &&
            (!effectiveBillLottery ||
              String(drawMap.get(String(b.draw_id))?.lottery_id) ===
                effectiveBillLottery),
        )
        .slice()
        .sort((a, b) => b.id - a.id),
    [visible, billStatus, effectiveBillLottery, drawMap],
  );
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
  const salesTable = (rows, name) => (
    <ReportPages key={`${tab}-${currency}`} rows={rows} label={name}>
      {(page) => (
        <div className="report-table-scroll">
          <table className="report-table history-table">
            <thead>
              <tr>
                <th>{name}</th>
                <th>จำนวนโพย</th>
                {currencies.map((c) => (
                  <th key={c}>ยอดขาย ({unit(c)})</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {page.map((row) => (
                <tr key={row.id}>
                  <th scope="row">{row.name}</th>
                  <td>{row.count.toLocaleString("th-TH")}</td>
                  {currencies.map((c) => (
                    <td key={c}>{money(row[c])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>รวม</th>
                <td>{active.length}</td>
                {currencies.map((c) => (
                  <td key={c}>
                    {money(rows.reduce((sum, row) => sum + row[c], 0))}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
          {!rows.length && <p className="muted">ไม่มีข้อมูลตามตัวกรอง</p>}
        </div>
      )}
    </ReportPages>
  );
  return (
    <>
      <DrawReports state={state} bills={state.bills || bills} />
      <details
        className="statistics-history"
        onToggle={(e) => setOpen(e.currentTarget.open)}
      >
        <summary>
          สถิติย้อนหลังและเลขขายสูงสุด <span>ดูภาพรวมทุกงวด</span>
        </summary>
        {open && (
          <div className="statistics-history-content">
            <div className="history-shared-filters">
              {filters}
              <div className="toolbar">
                <label>
                  สกุลเงินรายงาน
                  <select
                    value={currency}
                    onChange={(e) => {
                      setCurrency(e.target.value);
                      if (e.target.value !== "ALL")
                        setSortCurrency(e.target.value);
                    }}
                  >
                    <option value="ALL">บาทและกีบ</option>
                    <option value="THB">บาท</option>
                    <option value="LAK">กีบ (K)</option>
                  </select>
                </label>
              </div>
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
            <div
              className="history-tabs"
              role="tablist"
              aria-label="รายงานย้อนหลัง"
            >
              {[
                ["ranking", "เลขขายสูงสุดในงวด"],
                ["lotteries", "ยอดขายตามประเภทหวย"],
                ...(state.user.role !== "Member"
                  ? [
                      [
                        "people",
                        state.user.role === "Admin"
                          ? "ยอดขายตาม Leader"
                          : "ยอดขายตามสมาชิก",
                      ],
                    ]
                  : []),
                ["bills", "ผลรายโพย"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  id={`history-tab-${id}`}
                  role="tab"
                  aria-selected={tab === id}
                  aria-controls={`history-panel-${id}`}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <section
              className="panel history-report-panel"
              role="tabpanel"
              id={`history-panel-${tab}`}
              aria-labelledby={`history-tab-${tab}`}
            >
              {tab === "ranking" ? (
                <>
                  <h2>เลขขายสูงสุดในงวด</h2>
                  <div className="toolbar">
                    <label>
                      ประเภทหวย
                      <select
                        aria-label="ประเภทหวยรายงานเลขขายสูงสุด"
                        value={rankingLottery?.id || ""}
                        onChange={(e) => {
                          setRankingLotteryId(e.target.value);
                          setDrawId("");
                        }}
                      >
                        {!rankingLotteries.length && (
                          <option value="">ไม่มีประเภทหวย</option>
                        )}
                        <LotteryOptions items={rankingLotteries} />
                      </select>
                    </label>
                    <label>
                      งวด
                      <select
                        aria-label="งวดรายงานเลขขายสูงสุด"
                        value={selectedDraw?.id || ""}
                        onChange={(e) => setDrawId(e.target.value)}
                      >
                        {!rankingDraws.length && (
                          <option value="">ไม่มีงวดที่มียอดซื้อ</option>
                        )}
                        {rankingDraws.map((d) => (
                          <option key={d.id} value={d.id}>
                            {drawLabel(d)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      ประเภทเลข
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                      >
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
                            {unit(c)}
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
                  <p className="muted history-help">
                    ยอดจ่ายใช้ยอดซื้อ × อัตราจ่ายที่บันทึกในบิล รวมจ่ายครึ่งแล้ว
                    · โต๊ดรวมเลขสลับหลักที่ถูกร่วมกัน · เป็นยอดเฉพาะเลข/โหมดนี้
                    ไม่รวมโหมดอื่นที่อาจถูกพร้อมกัน · จ่ายเกินยอดซื้อทั้งงวด =
                    ยอดจ่ายลบยอดซื้อทุกโหมดในงวดและสกุลเงินเดียวกัน (ไม่เกินแสดง
                    0)
                  </p>
                  <ReportPages
                    key={`${selectedDraw?.id}-${currency}-${sortCurrency}-${direction}-${type}`}
                    rows={ranking}
                    label="เลข"
                  >
                    {(page, offset) => (
                      <div className="report-table-scroll">
                        <table className="report-table history-table">
                          <thead>
                            <tr>
                              <th>อันดับ</th>
                              <th>เลข</th>
                              <th>ประเภท</th>
                              {currencies.map((c) => (
                                <th key={c}>ยอดซื้อ ({unit(c)})</th>
                              ))}
                              <th>ต้องจ่ายหากเลขถูก</th>
                              <th>จ่ายเกินยอดซื้อทั้งงวด</th>
                            </tr>
                          </thead>
                          <tbody>
                            {page.map((row, i) => (
                              <tr key={row.key}>
                                <td>{offset + i + 1}</td>
                                <td>
                                  <strong>{row.number}</strong>
                                </td>
                                <td>{labels[row.type]}</td>
                                {currencies.map((c) => (
                                  <td key={c}>{money(row[c])}</td>
                                ))}
                                <td>
                                  <span className="report-amounts">
                                    {currencies.map((c) => (
                                      <strong key={c}>
                                        {amount(row.payout[c], c)}
                                      </strong>
                                    ))}
                                  </span>
                                </td>
                                <td>
                                  <span className="report-amounts">
                                    {currencies.map((c) => (
                                      <strong key={c}>
                                        {amount(row.excess[c], c)}
                                      </strong>
                                    ))}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {!ranking.length && (
                          <p className="muted">ไม่มีรายการซื้อในงวดที่เลือก</p>
                        )}
                      </div>
                    )}
                  </ReportPages>
                </>
              ) : tab === "lotteries" ? (
                <>
                  <h2>ยอดขายแยกตามประเภทหวย</h2>
                  <p className="muted">สรุปเฉพาะบิลที่ใช้งาน แยกยอดบาทและกีบ</p>
                  {salesTable(sales.lotteries, "ประเภทหวย")}
                </>
              ) : tab === "people" ? (
                <>
                  <h2>
                    {state.user.role === "Admin"
                      ? "ยอดขายแยกตาม Leader"
                      : "ยอดขายแยกตามสมาชิก"}
                  </h2>
                  {salesTable(
                    sales.people,
                    state.user.role === "Admin" ? "Leader" : "สมาชิก",
                  )}
                </>
              ) : (
                <>
                  <h2>ผลรายโพย</h2>
                  <div className="toolbar">
                    <label>
                      ประเภทหวย
                      <select
                        value={effectiveBillLottery}
                        onChange={(e) => setBillLottery(e.target.value)}
                      >
                        <option value="">ทุกประเภทหวย</option>
                        <LotteryOptions items={catalog} />
                      </select>
                    </label>
                    <label>
                      สถานะโพย
                      <select
                        value={billStatus}
                        onChange={(e) => setBillStatus(e.target.value)}
                      >
                        <option value="">ทุกสถานะ</option>
                        <option value="active">ใช้งาน</option>
                        <option value="cancelled">ยกเลิก</option>
                      </select>
                    </label>
                  </div>
                  <BillPages
                    initialPageSize={10}
                    pageSizes={[10, 25, 50]}
                    key={`${currency}-${effectiveBillLottery}-${billStatus}`}
                    bills={historyBills}
                    renderBill={(b) => (
                      <BillCard key={b.id} b={b} state={state} />
                    )}
                    empty={<p className="muted">ไม่มีโพยตามตัวกรอง</p>}
                  />
                </>
              )}
            </section>
          </div>
        )}
      </details>
    </>
  );
}
