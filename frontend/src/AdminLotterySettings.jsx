import LotteryOptions from "./LotteryOptions.jsx";
import React, { useState } from "react";
import { Plus, Pencil, Trash2, CalendarDays } from "lucide-react";
import LotteryFlag from "./LotteryFlag.jsx";

const date = (v) => String(v).slice(0, 10).split("-").reverse().join("-");
const localDateTime = (v) =>
  v
    ? new Date(new Date(v).getTime() + 7 * 3600000).toISOString().slice(0, 16)
    : "";
const kinds = ["หวยไทย", "หวยนอก"];

function LotteryEditor({ lottery, onSave }) {
  return (
    <form
      className="admin-edit-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(Object.fromEntries(new FormData(e.currentTarget)));
      }}
    >
      <label>
        ชื่อหวย
        <input
          name="name"
          required
          defaultValue={lottery?.name || ""}
          placeholder="เช่น หวยลาว"
        />
      </label>
      <div className="admin-form-pair">
        <label>
          ชนิดหวย
          <select name="kind" defaultValue={lottery?.kind || "หวยไทย"}>
            {kinds.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label>
          ธง
          <select name="flag" defaultValue={lottery?.flag || "🎟️"}>
            {[
              ...new Set(
                ["🇹🇭", "🇱🇦", "🇻🇳", "🎟️", lottery?.flag].filter(Boolean),
              ),
            ].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
      </div>
      <button className="primary">
        {lottery ? "บันทึกการแก้ไข" : "เพิ่มประเภทหวย"}
      </button>
    </form>
  );
}

export function DrawEditor({ lotteries, lotteryId, draw, onSave }) {
  const existing = localDateTime(draw?.result_at);
  const [drawDate, setDrawDate] = useState(
    draw ? String(draw.draw_date).slice(0, 10) : "",
  );
  const [resultDate, setResultDate] = useState(existing.slice(0, 10));
  const [manualDate, setManualDate] = useState(Boolean(draw));
  const [hour, setHour] = useState(existing.slice(11, 13));
  const [minute, setMinute] = useState(existing.slice(14, 16));
  return (
    <form
      className="admin-edit-form"
      onSubmit={(e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(e.currentTarget));
        onSave({
          lottery_id: draw?.lottery_id || Number(v.lottery_id),
          draw_date: drawDate,
          result_at: `${resultDate}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`,
        });
      }}
    >
      <label>
        ประเภทหวย
        <select
          name="lottery_id"
          required
          defaultValue={lotteryId || draw?.lottery_id || ""}
          disabled={Boolean(draw)}
        >
          <option value="" disabled>
            เลือกหวย
          </option>
          <LotteryOptions items={lotteries} />
        </select>
      </label>
      <label>
        วันที่งวด
        <input
          type="date"
          name="draw_date"
          required
          value={drawDate}
          onInput={(e) => {
            setDrawDate(e.currentTarget.value);
            if (!manualDate) setResultDate(e.currentTarget.value);
          }}
          onChange={(e) => {
            setDrawDate(e.target.value);
            if (!manualDate) setResultDate(e.target.value);
          }}
        />
      </label>
      <fieldset className="admin-release-fields">
        <legend>เผยแพร่ผลรางวัล</legend>
        <div className="admin-form-pair">
          <label>
            วันที่เผยแพร่
            <input
              aria-label="วันที่เผยแพร่ผล"
              type="date"
              required
              value={resultDate}
              onInput={(e) => {
                setResultDate(e.currentTarget.value);
                setManualDate(true);
              }}
              onChange={(e) => {
                setResultDate(e.target.value);
                setManualDate(true);
              }}
            />
          </label>
          <div className="admin-release-time">
            <span>เวลาเผยแพร่ (24 ชั่วโมง)</span>
            <div className="admin-release-time-inputs">
              <label>
                ชั่วโมง
                <input
                  aria-label="ชั่วโมงเผยแพร่ผล"
                  type="text"
                  inputMode="numeric"
                  pattern="([01]?[0-9]|2[0-3])"
                  maxLength={2}
                  placeholder="18"
                  title="กรอกชั่วโมง 0–23"
                  required
                  value={hour}
                  onChange={(e) =>
                    setHour(e.target.value.replace(/\D/g, "").slice(0, 2))
                  }
                  onBlur={() =>
                    setHour((value) => (value ? value.padStart(2, "0") : ""))
                  }
                />
              </label>
              <span className="admin-time-colon" aria-hidden="true">
                :
              </span>
              <label>
                นาที
                <input
                  aria-label="นาทีเผยแพร่ผล"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-5]?[0-9]"
                  maxLength={2}
                  placeholder="30"
                  title="กรอกนาที 0–59"
                  required
                  value={minute}
                  onChange={(e) =>
                    setMinute(e.target.value.replace(/\D/g, "").slice(0, 2))
                  }
                  onBlur={() =>
                    setMinute((value) => (value ? value.padStart(2, "0") : ""))
                  }
                />
              </label>
            </div>
          </div>
        </div>
        <p className="muted">
          วันที่เผยแพร่ตามวันที่งวดโดยอัตโนมัติ เปลี่ยนเองได้ · เวลาไทย
        </p>
      </fieldset>
      <button className="primary">{draw ? "บันทึกงวด" : "เพิ่มงวด"}</button>
    </form>
  );
}

export function ResultEditor({ draw, onSave }) {
  return (
    <form
      className="admin-edit-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(Object.fromEntries(new FormData(e.currentTarget)));
      }}
    >
      <p className="muted">
        {draw.name} · งวด {date(draw.draw_date)}
      </p>
      <div className="admin-result-inputs">
        {[
          ["top3", "3 ตัวบน", 3],
          ["top2", "2 ตัวบน", 2],
          ["bottom2", "2 ตัวล่าง", 2],
        ].map(([key, label, size]) => (
          <label key={key}>
            {label}
            <input
              name={key}
              inputMode="numeric"
              pattern={`[0-9]{${size}}`}
              maxLength={size}
              required
              defaultValue={draw[key] || ""}
              placeholder={"0".repeat(size)}
            />
          </label>
        ))}
      </div>
      <button className="primary">บันทึกผลรางวัล</button>
    </form>
  );
}

export default function AdminLotterySettings({
  state,
  api,
  act,
  modal,
  search,
  mode,
}) {
  const [lotteryFilter, setLotteryFilter] = useState("");
  const [status, setStatus] = useState("pending");
  const matches = (r) =>
    [r.name, r.kind, r.draw_date, date(r.draw_date || "")]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase());
  const save = (path, method, value) =>
    act(async () => {
      await api[method](path, value);
      modal(null);
    });
  const editLottery = (lottery) =>
    modal({
      title: lottery ? `แก้ไข ${lottery.name}` : "เพิ่มประเภทหวย",
      content: (
        <LotteryEditor
          lottery={lottery}
          onSave={(v) =>
            save(
              lottery ? `/lotteries/${lottery.id}` : "/lotteries",
              lottery ? "put" : "post",
              v,
            )
          }
        />
      ),
    });
  const editDraw = (lotteryId, draw) =>
    modal({
      title: draw ? `แก้ไขงวด ${draw.name}` : "เพิ่มงวดหวย",
      content: (
        <DrawEditor
          lotteries={state.lotteries.filter((l) => !l.deleted_at)}
          lotteryId={lotteryId}
          draw={draw}
          onSave={(v) =>
            save(
              draw ? `/draws/${draw.id}` : "/draws",
              draw ? "put" : "post",
              v,
            )
          }
        />
      ),
    });
  const catalog = state.lotteries.filter((l) => !l.deleted_at);
  const lotteries = catalog.filter(matches);
  const draws = state.draws
    .filter((d) => catalog.some((l) => l.id === d.lottery_id))
    .filter(matches)
    .filter(
      (d) =>
        (!lotteryFilter || String(d.lottery_id) === lotteryFilter) &&
        (status === "all" ||
          (status === "pending" ? !d.top3 : Boolean(d.top3))),
    )
    .sort(
      (a, b) =>
        String(b.draw_date).localeCompare(String(a.draw_date)) || b.id - a.id,
    );
  return (
    <section className="panel admin-catalog">
      <div className="section-head">
        <div>
          <span className="report-eyebrow">จัดการข้อมูลหวย</span>
          <h2>{mode === "lotteries" ? "ประเภทหวย" : "งวดและผลรางวัล"}</h2>
          <p className="muted">
            {mode === "lotteries"
              ? "เปิดรับหวย เพิ่มงวด และแก้ไขข้อมูลได้จากรายการเดียว"
              : "ตรวจงวดที่รอผล และบันทึกผลรางวัลแยกแต่ละงวด"}
          </p>
        </div>
        <button
          className="primary"
          onClick={() =>
            mode === "lotteries" ? editLottery() : editDraw(lotteryFilter)
          }
        >
          <Plus size={16} />
          {mode === "lotteries" ? "เพิ่มประเภทหวย" : "เพิ่มงวด"}
        </button>
      </div>
      {mode === "draws" && (
        <div className="admin-catalog-filters">
          <label>
            ประเภทหวย
            <select
              value={lotteryFilter}
              onChange={(e) => setLotteryFilter(e.target.value)}
            >
              <option value="">ทุกประเภทหวย</option>
              <LotteryOptions items={catalog} />
            </select>
          </label>
          <div className="admin-status-tabs" aria-label="สถานะงวด">
            {[
              ["pending", "รอผลรางวัล"],
              ["result", "บันทึกผลแล้ว"],
              ["all", "ทุกงวด"],
            ].map(([key, name]) => (
              <button
                key={key}
                className={status === key ? "active" : ""}
                aria-pressed={status === key}
                onClick={() => setStatus(key)}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="admin-catalog-scroll">
        <table className="admin-catalog-table">
          <thead>
            <tr>
              {(mode === "lotteries"
                ? ["ชื่อหวย", "ชนิด", "สถานะ", "จำนวนงวด", "จัดการ"]
                : [
                    "หวย / งวด",
                    "เผยแพร่ผล (เวลาไทย)",
                    "ผลรางวัล",
                    "สถานะ",
                    "จัดการ",
                  ]
              ).map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mode === "lotteries"
              ? lotteries.map((l) => {
                  const drawCount = state.draws.filter(
                    (d) => d.lottery_id === l.id,
                  ).length;
                  return (
                    <tr key={l.id}>
                      <td>
                        <strong className="admin-lottery-name">
                          <LotteryFlag flag={l.flag} />
                          {l.name}
                        </strong>
                      </td>
                      <td>{l.kind}</td>
                      <td>
                        <button
                          className={
                            "admin-state-badge " +
                            (l.enabled ? "is-enabled" : "")
                          }
                          onClick={() =>
                            act(() =>
                              api.patch(`/lotteries/${l.id}`, {
                                enabled: !l.enabled,
                              }),
                            )
                          }
                        >
                          {l.enabled ? "เปิดรับ" : "ปิดรับ"}
                        </button>
                      </td>
                      <td>{drawCount} งวด</td>
                      <td>
                        <div className="admin-row-actions">
                          <button onClick={() => editDraw(l.id)}>
                            <CalendarDays size={14} />
                            เพิ่มงวด
                          </button>
                          <button onClick={() => editLottery(l)}>
                            <Pencil size={14} />
                            แก้ไข
                          </button>
                          <button
                            className="admin-delete"
                            title="ลบประเภทหวย"
                            onClick={() =>
                              modal({
                                title: `ยืนยันลบ ${l.name}?`,
                                content: (
                                  <p>
                                    ลบหวยนี้ออกจากหน้าผลและการขายของทุกเครือข่าย
                                    บิลและผลเดิมจะยังเก็บไว้ในรายงานย้อนหลัง
                                  </p>
                                ),
                                confirm: () =>
                                  act(async () => {
                                    await api.delete(`/lotteries/${l.id}`, {
                                      data: { confirm: true },
                                    });
                                    modal(null);
                                  }),
                              })
                            }
                          >
                            <Trash2 size={14} />
                            <span>ลบ</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              : draws.map((d) => {
                  const hasBills = state.bills.some(
                    (b) => String(b.draw_id) === String(d.id),
                  );
                  const release = localDateTime(d.result_at);
                  return (
                    <tr key={d.id}>
                      <td>
                        <strong className="admin-lottery-name">
                          <LotteryFlag flag={d.flag} />
                          {d.name}
                        </strong>
                        <small>งวด {date(d.draw_date)}</small>
                      </td>
                      <td>
                        {date(release)}
                        <small>{release.slice(11, 16)} น.</small>
                      </td>
                      <td>
                        <div className="admin-result-chips">
                          {[
                            ["3 บน", d.top3],
                            ["2 บน", d.top2],
                            ["2 ล่าง", d.bottom2],
                          ].map(([label, value]) => (
                            <span key={label}>
                              <small>{label}</small>
                              <b>{value || "—"}</b>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span
                          className={
                            "admin-state-badge " + (d.top3 ? "is-enabled" : "")
                          }
                        >
                          {d.top3 ? "บันทึกผลแล้ว" : "รอผล"}
                        </span>
                      </td>
                      <td>
                        <div className="admin-row-actions">
                          <button
                            className="admin-result-action"
                            onClick={() =>
                              modal({
                                title: `ผลรางวัล ${d.name}`,
                                content: (
                                  <ResultEditor
                                    draw={d}
                                    onSave={(v) =>
                                      save(`/draws/${d.id}`, "patch", v)
                                    }
                                  />
                                ),
                              })
                            }
                          >
                            {d.top3 ? "แก้ไขผล" : "บันทึกผล"}
                          </button>
                          <button
                            onClick={() => editDraw(d.lottery_id, d)}
                            title="แก้ไขงวด"
                          >
                            <Pencil size={14} />
                            <span>แก้ไขงวด</span>
                          </button>
                          <button
                            className="admin-delete"
                            disabled={hasBills}
                            title={
                              hasBills ? "งวดมีโพยแล้ว จึงลบไม่ได้" : "ลบงวด"
                            }
                            onClick={() =>
                              modal({
                                title: `ลบงวด ${d.name} ${date(d.draw_date)}`,
                                confirm: () => save(`/draws/${d.id}`, "delete"),
                              })
                            }
                          >
                            <Trash2 size={14} />
                            <span>ลบ</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            {!(mode === "lotteries" ? lotteries : draws).length && (
              <tr>
                <td colSpan={5} className="admin-empty">
                  ไม่พบรายการตามเงื่อนไขที่เลือก
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="admin-catalog-footnote">
        {mode === "lotteries"
          ? `${lotteries.length} ประเภท · ลบได้ทุกประเภท โดยเก็บประวัติบิลเดิม`
          : `${draws.length} งวด · ลบได้เฉพาะงวดที่ไม่มีโพย`}
      </p>
    </section>
  );
}
