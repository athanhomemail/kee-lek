import React, { useState } from "react";
import ReportPages from "./ReportPages.jsx";
const day = (value) => String(value).split("-").reverse().join("/");
export default function DrawExceptionsEditor({
  lottery,
  schedule,
  api,
  onSaved,
  modal,
}) {
  const [date, setDate] = useState(""),
    [action, setAction] = useState("move"),
    [toDate, setToDate] = useState("");
  const [time, setTime] = useState(null),
    [offset, setOffset] = useState(null),
    [note, setNote] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const exceptions = schedule?.config?.exceptions || [];
  const resultTime = time ?? schedule?.config?.resultTime ?? "";
  const resultOffset = offset ?? schedule?.config?.resultDayOffset ?? 0;
  const save = async (value) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { data } = await api.post(
        `/draw-schedules/${lottery.id}/exceptions`,
        value,
      );
      await onSaved();
      setMessage(
        data.errors?.length
          ? "บันทึกข้อยกเว้นแล้ว แต่ตรวจเปิดงวดไม่สำเร็จ กรุณาดูสถานะระบบ"
          : "บันทึกข้อยกเว้นแล้ว Auto จะไม่สร้างวันเดิมซ้ำ",
      );
      setDate("");
      setToDate("");
      setNote("");
      setTime(null);
      setOffset(null);
      return true;
    } catch (e) {
      setError(e.response?.data?.error || "บันทึกข้อยกเว้นไม่สำเร็จ");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="auto-draw-exceptions">
      <h3>ข้อยกเว้นรายงวด · {lottery.name}</h3>
      <p className="muted">
        เลื่อนหรือข้ามเฉพาะวันที่ระบุ รอบอื่นยังใช้ตารางปกติ
        ใช้ได้ทั้งวันของเดือนและวันในสัปดาห์
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const value = { date, action, note };
          if (action === "move")
            Object.assign(value, {
              toDate,
              resultTime,
              resultDayOffset: resultOffset,
            });
          modal({
            title:
              action === "move"
                ? `ยืนยันเลื่อนงวด ${day(date)} → ${day(toDate)}?`
                : `ยืนยันข้ามงวด ${day(date)}?`,
            content: (
              <p>
                {action === "move"
                  ? "ถ้ามีงวดเดิมแล้ว ระบบจะเลื่อนวัน เวลาเผยแพร่ผล และเวลาปิดรับรายงวดให้ โดยคงเลขงวด โพย ยอดเงิน และอัตราเดิมไว้ งวดที่กรอกผลแล้วหรือวันปลายทางมีงวดอยู่แล้วจะเลื่อนไม่ได้"
                  : "หากสร้างงวดแล้ว จะข้ามและลบได้เฉพาะงวดที่ยังไม่มีโพยหรือผลรางวัล Auto จะไม่สร้างวันนั้นกลับมา"}
              </p>
            ),
            confirm: async () => {
              modal(null);
              await save(value);
            },
          });
        }}
      >
        <fieldset disabled={busy} className="auto-draw-fields">
          <div className="admin-form-pair">
            <label>
              วันงวดเดิม
              <input
                type="date"
                required
                value={date}
                onInput={(e) => setDate(e.currentTarget.value)}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
            <label>
              การเปลี่ยนแปลง
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
              >
                <option value="move">เลื่อนไปวันอื่น</option>
                <option value="skip">ข้าม / งดงวดนี้</option>
              </select>
            </label>
          </div>
          {action === "move" && (
            <>
              <label>
                วันงวดใหม่
                <input
                  type="date"
                  required
                  value={toDate}
                  onInput={(e) => setToDate(e.currentTarget.value)}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </label>
              <div className="admin-form-pair">
                <label>
                  เวลาเผยแพร่ผลของงวดใหม่
                  <input
                    type="time"
                    required
                    value={resultTime}
                    onInput={(e) => setTime(e.currentTarget.value.slice(0, 5))}
                    onChange={(e) => setTime(e.target.value.slice(0, 5))}
                  />
                </label>
                <label>
                  เผยแพร่หลังวันงวดใหม่กี่วัน
                  <input
                    type="number"
                    min="0"
                    max="7"
                    required
                    value={resultOffset}
                    onChange={(e) =>
                      setOffset(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                  />
                </label>
              </div>
            </>
          )}
          <label>
            หมายเหตุ
            <input
              maxLength="200"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น เลื่อนเนื่องจากวันหยุด"
            />
          </label>
          <button type="submit" className="primary">
            {busy ? "กำลังบันทึก…" : "บันทึกข้อยกเว้น"}
          </button>
        </fieldset>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {exceptions.length > 0 && (
        <ReportPages rows={exceptions} label="ข้อยกเว้น">
          {(rows) => (
            <div className="report-table-scroll">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>วันงวดเดิม</th>
                    <th>เปลี่ยนเป็น</th>
                    <th>หมายเหตุ</th>
                    <th>จัดการ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.date}>
                      <td>{day(row.date)}</td>
                      <td>
                        {row.action === "move" ? day(row.toDate) : "ข้ามงวด"}
                      </td>
                      <td>{row.note || "—"}</td>
                      <td>
                        <button
                          disabled={busy}
                          onClick={() => {
                            setDate(row.date);
                            setAction(row.action);
                            setToDate(row.toDate || "");
                            setTime(
                              row.resultTime ||
                                schedule?.config?.resultTime ||
                                "",
                            );
                            setOffset(
                              row.resultDayOffset ??
                                schedule?.config?.resultDayOffset ??
                                0,
                            );
                            setNote(row.note || "");
                            setError("");
                            setMessage("");
                          }}
                        >
                          แก้ไข
                        </button>{" "}
                        <button
                          disabled={busy}
                          onClick={() =>
                            modal({
                              title: `คืนตารางปกติสำหรับ ${day(row.date)}?`,
                              content: (
                                <p>
                                  Auto จะใช้วันเดิมอีกครั้ง
                                  หากเคยเลื่อนและมีงวดแล้ว
                                  ระบบจะย้ายงวดพร้อมโพยกลับวันเดิม
                                  โดยต้องเป็นงวดที่ยังไม่กรอกผล
                                  วันเดิมยังไม่ผ่าน และไม่มีงวดซ้ำ
                                </p>
                              ),
                              confirm: async () => {
                                modal(null);
                                await save({
                                  date: row.date,
                                  action: "restore",
                                });
                              },
                            })
                          }
                        >
                          คืนวันเดิม
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ReportPages>
      )}
      <p className="muted">
        การเลื่อนวันที่หรือลบงวดผ่านเมนู “งวดและผลรางวัล”
        จะบันทึกข้อยกเว้นให้อัตโนมัติด้วย ไม่รวมการแก้ข้อมูลตรงในฐานข้อมูล
      </p>
    </section>
  );
}
