import DrawExceptionsEditor from "./DrawExceptionsEditor.jsx";
import React, { useCallback, useEffect, useState } from "react";
import LotteryOptions from "./LotteryOptions.jsx";
const defaults = {
  enabled: false,
  mode: "weekdays",
  days: [],
  resultTime: "",
  resultDayOffset: 0,
};
const weekdays = [
  "จันทร์",
  "อังคาร",
  "พุธ",
  "พฤหัสบดี",
  "ศุกร์",
  "เสาร์",
  "อาทิตย์",
];
const date = (value) =>
  value
    ? new Date(value).toLocaleString("th-TH", {
        timeZone: "Asia/Bangkok",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";
function ScheduleEditor({ lottery, schedule, api, onSaved }) {
  const [draft, setDraft] = useState(() => ({
    ...defaults,
    ...schedule?.config,
  }));
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const dayOptions =
    draft.mode === "weekdays"
      ? weekdays.map((name, i) => ({ day: i + 1, name }))
      : Array.from({ length: 31 }, (_, i) => ({
          day: i + 1,
          name: String(i + 1),
        }));
  const patch = (value) => {
    setDraft((previous) => ({ ...previous, ...value }));
    setMessage("");
    setError("");
  };
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        setMessage("");
        try {
          const { data } = await api.put(
            `/draw-schedules/${lottery.id}`,
            draft,
          );
          await onSaved();
          if (data.errors?.length)
            setError("บันทึกแล้ว แต่ตรวจเปิดงวดไม่สำเร็จ กรุณาดูสถานะด้านล่าง");
          else
            setMessage(
              data.created?.length
                ? "บันทึกแล้ว และเปิดงวดใหม่เรียบร้อย"
                : data.busy
                  ? "บันทึกแล้ว ระบบจะตรวจอีกครั้งภายใน 1 นาที"
                  : "บันทึกแล้ว",
            );
        } catch (e) {
          setError(e.response?.data?.error || "บันทึกไม่สำเร็จ");
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy} className="auto-draw-fields">
        <label className="auto-draw-toggle">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => patch({ enabled: e.target.checked })}
          />
          เปิดงวดอัตโนมัติ · {lottery.name}
        </label>
        {!lottery.enabled && (
          <p className="muted">
            หวยนี้ระบบกลางปิดรับอยู่ จะยังไม่สร้างงวดจนกว่า Admin จะเปิดรับ
          </p>
        )}
        <label>
          รูปแบบวันเปิดงวด
          <select
            value={draft.mode}
            onChange={(e) => patch({ mode: e.target.value, days: [] })}
          >
            <option value="weekdays">วันในสัปดาห์</option>
            <option value="monthdays">วันที่ของทุกเดือน</option>
          </select>
        </label>
        <div className="auto-draw-day-actions">
          <button
            type="button"
            onClick={() => patch({ days: dayOptions.map((d) => d.day) })}
          >
            เลือกทุกวัน
          </button>
          <button type="button" onClick={() => patch({ days: [] })}>
            ล้างการเลือก
          </button>
        </div>
        <div
          className={`auto-draw-days ${draft.mode === "monthdays" ? "month-days" : ""}`}
        >
          {dayOptions.map(({ day, name }) => (
            <label key={day}>
              <input
                type="checkbox"
                checked={draft.days.includes(day)}
                onChange={(e) =>
                  patch({
                    days: e.target.checked
                      ? [...draft.days, day].sort((a, b) => a - b)
                      : draft.days.filter((d) => d !== day),
                  })
                }
              />
              {name}
            </label>
          ))}
        </div>
        {draft.mode === "monthdays" && (
          <p className="muted">
            เช่น 1 และ 16 · วันที่ไม่มีในเดือนนั้น เช่น 31 ก.พ. จะข้ามไป
          </p>
        )}
        <div className="admin-form-pair">
          <label>
            เวลาเผยแพร่ผล (เวลาไทย)
            <input
              type="time"
              required={draft.enabled}
              value={draft.resultTime}
              onInput={(e) =>
                patch({ resultTime: e.currentTarget.value.slice(0, 5) })
              }
              onChange={(e) =>
                patch({ resultTime: e.target.value.slice(0, 5) })
              }
            />
          </label>
          <label>
            เผยแพร่หลังวันที่งวดกี่วัน
            <input
              type="number"
              min="0"
              max="7"
              required
              value={draft.resultDayOffset}
              onChange={(e) =>
                patch({
                  resultDayOffset:
                    e.target.value === "" ? "" : Number(e.target.value),
                })
              }
            />
          </label>
        </div>
        <p className="muted">
          0 = เผยแพร่ในวันงวด · เวลาปิดรับยังใช้ค่าที่ Leader ตั้งไว้ตามเดิม
        </p>
        <button className="primary" type="submit">
          {busy ? "กำลังบันทึก…" : "บันทึกตั้งค่างวดอัตโนมัติ"}
        </button>
        {message && <p role="status">{message}</p>}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </fieldset>
    </form>
  );
}
export default function AutoDrawSettings({ state, api, search = "", modal }) {
  const lotteries = state.lotteries.filter((l) => !l.deleted_at);
  const visible = lotteries.filter((l) =>
    `${l.name} ${l.kind}`.toLowerCase().includes(search.toLowerCase()),
  );
  const [selected, setSelected] = useState(""),
    [rows, setRows] = useState(null),
    [error, setError] = useState(""),
    [checking, setChecking] = useState(false);
  const lottery = visible.find((l) => String(l.id) === selected) || visible[0];
  const load = useCallback(async () => {
    const { data } = await api.get("/draw-schedules");
    setRows(data);
    setError("");
  }, [api]);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const { data } = await api.get("/draw-schedules");
        if (active) {
          setRows(data);
          setError("");
        }
      } catch (e) {
        if (active)
          setError(
            e.response?.data?.error || "โหลดตั้งค่างวดอัตโนมัติไม่สำเร็จ",
          );
      }
    };
    void refresh();
    const timer = setInterval(refresh, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [api]);
  const schedule = rows?.find(
    (r) => String(r.lottery_id) === String(lottery?.id),
  );
  return (
    <section className="panel auto-draw-settings">
      <div className="section-head">
        <div>
          <h2>เปิดงวดอัตโนมัติ</h2>
          <p className="muted">
            เลือกวันเปิดงวดและเวลาเผยแพร่ผลแยกตามประเภทหวย
          </p>
        </div>
        <button
          disabled={checking || !rows}
          onClick={async () => {
            setChecking(true);
            try {
              const { data } = await api.post("/draw-schedules/check");
              await load();
              if (data.errors?.length)
                setError("บางประเภทหวยตรวจไม่สำเร็จ กรุณาตรวจสถานะ");
            } catch (e) {
              setError(e.response?.data?.error || "ตรวจไม่สำเร็จ");
            } finally {
              setChecking(false);
            }
          }}
        >
          {checking ? "กำลังตรวจ…" : "ตรวจเปิดงวดตอนนี้"}
        </button>
      </div>
      <p>
        ระบบตรวจทุก 1 นาที
        สร้างงวดที่ใกล้ที่สุดตั้งแต่วันนี้และยังไม่เลยเวลาเผยแพร่ผล
        รอให้งวดก่อนหน้ากรอกผลครบก่อน หากยังไม่มีงวดเลย จะสร้างงวดแรกให้ได้
      </p>
      <label>
        ประเภทหวย
        <select
          value={lottery?.id || ""}
          onChange={(e) => setSelected(e.target.value)}
        >
          {!visible.length && <option value="">ไม่พบประเภทหวย</option>}
          <LotteryOptions items={visible} />
        </select>
      </label>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {!rows && !error && <p role="status">กำลังโหลด…</p>}
      {lottery && rows && (
        <>
          <ScheduleEditor
            key={lottery.id}
            lottery={lottery}
            schedule={schedule}
            api={api}
            onSaved={load}
          />
          <DrawExceptionsEditor
            key={`exceptions-${lottery.id}`}
            lottery={lottery}
            schedule={schedule}
            api={api}
            onSaved={load}
            modal={modal}
          />
          <div className="auto-draw-status">
            <strong>สถานะล่าสุด</strong>
            <p>
              {schedule?.last_status ||
                "ยังไม่ตั้งค่า · ค่าเริ่มต้นปิดอัตโนมัติ"}
            </p>
            <small>ตรวจล่าสุด {date(schedule?.last_checked_at)}</small>
            {schedule?.next && (
              <p>
                วันตามตารางถัดไป{" "}
                {schedule.next.drawDate.split("-").reverse().join("/")} ·
                เผยแพร่ {date(schedule.next.resultAt)}
              </p>
            )}
          </div>
        </>
      )}
      <p className="muted">
        ระบบไม่เติมงวดย้อนหลัง ไม่ใส่ผลรางวัลอัตโนมัติ และไม่แก้งวดที่ Admin
        เพิ่มไว้แล้ว
      </p>
    </section>
  );
}
