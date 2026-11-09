import { validateDrawExceptions, resultDateTime } from "./draw-exceptions.js";
import { bangkokToday } from "./lottery-catalog.js";
export const defaultDrawSchedule = {
  enabled: false,
  mode: "weekdays",
  days: [],
  resultTime: "",
  resultDayOffset: 0,
  exceptions: [],
};
export function validateDrawSchedule(input) {
  if (
    !input ||
    typeof input.enabled !== "boolean" ||
    !["weekdays", "monthdays"].includes(input.mode) ||
    !Array.isArray(input.days)
  )
    throw Error("รูปแบบตั้งค่างวดอัตโนมัติไม่ถูกต้อง");
  const max = input.mode === "weekdays" ? 7 : 31;
  if (
    input.days.some((day) => !Number.isInteger(day) || day < 1 || day > max) ||
    input.days.length > max
  )
    throw Error("วันที่เปิดงวดไม่ถูกต้อง");
  if (
    !Number.isInteger(input.resultDayOffset) ||
    input.resultDayOffset < 0 ||
    input.resultDayOffset > 7
  )
    throw Error("จำนวนวันเลื่อนเผยแพร่ผลต้องเป็น 0–7");
  if (
    typeof input.resultTime !== "string" ||
    (input.resultTime !== "" &&
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.resultTime)) ||
    (input.enabled && (!input.days.length || !input.resultTime))
  )
    throw Error("กรุณาเลือกวันเปิดงวดและเวลาเผยแพร่ผล");
  return {
    enabled: input.enabled,
    mode: input.mode,
    days: [...new Set(input.days)].sort((a, b) => a - b),
    resultTime: input.resultTime,
    resultDayOffset: input.resultDayOffset,
    exceptions: validateDrawExceptions(input.exceptions),
  };
}
export function nextScheduledDraw(config, now = new Date()) {
  now = new Date(now);
  config = validateDrawSchedule(config);
  if (!config.enabled) return null;
  const today = bangkokToday(now);
  const start = new Date(today + "T00:00:00Z");
  const suppressed = new Set(
    config.exceptions.flatMap((row) =>
      row.action === "move" ? [row.date, row.toDate] : [row.date],
    ),
  );
  const candidates = [];
  for (const row of config.exceptions)
    if (row.action === "move" && row.toDate >= today) {
      const resultAt = resultDateTime(
        row.toDate,
        row.resultTime || config.resultTime,
        row.resultDayOffset ?? config.resultDayOffset,
      );
      if (resultAt > now) candidates.push({ drawDate: row.toDate, resultAt });
    }
  for (let offset = 0; offset < 370; offset++) {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() + offset);
    const match =
      config.mode === "weekdays" ? day.getUTCDay() || 7 : day.getUTCDate();
    const drawDate = day.toISOString().slice(0, 10);
    if (!config.days.includes(match) || suppressed.has(drawDate)) continue;
    const resultAt = resultDateTime(
      drawDate,
      config.resultTime,
      config.resultDayOffset,
    );
    if (resultAt <= now) continue;
    candidates.push({ drawDate, resultAt });
    break;
  }
  return (
    candidates.sort(
      (a, b) => a.drawDate.localeCompare(b.drawDate) || a.resultAt - b.resultAt,
    )[0] || null
  );
}
export function previousDrawReady(previous) {
  return (
    !previous ||
    (/^\d{3}$/.test(previous.top3 || "") &&
      /^\d{2}$/.test(previous.top2 || "") &&
      /^\d{2}$/.test(previous.bottom2 || ""))
  );
}
// Parent-row locks serialize schedule edits, multiple API workers and draw inserts.
// Existing draws, results, settings and bills are never updated by this job.
export async function runAutoDraws(
  database,
  { now = new Date(), lotteryId, onCreated = () => {} } = {},
) {
  const query = async (sql, args = [], connection = database) =>
    (await connection.query(sql, args))[0];
  const ids = await query(
    "SELECT lottery_id FROM lottery_draw_schedules" +
      (lotteryId ? " WHERE lottery_id=?" : "") +
      " ORDER BY lottery_id",
    lotteryId ? [lotteryId] : [],
  );
  const result = { created: [], errors: [] };
  for (const { lottery_id: id } of ids) {
    const connection = await database.getConnection();
    let createdId = null;
    try {
      await connection.beginTransaction();
      const [lottery] = await query(
        "SELECT id,enabled,deleted_at FROM lotteries WHERE id=? FOR UPDATE",
        [id],
        connection,
      );
      const [schedule] = await query(
        "SELECT config FROM lottery_draw_schedules WHERE lottery_id=? FOR UPDATE",
        [id],
        connection,
      );
      if (!lottery || !schedule) {
        await connection.rollback();
        continue;
      }
      let status = "ปิดงวดอัตโนมัติ";
      if (lottery.deleted_at || !lottery.enabled)
        status = "ประเภทหวยถูกลบหรือปิดรับ";
      else {
        const target = nextScheduledDraw(schedule.config, now);
        if (target) {
          const [existing] = await query(
            "SELECT id FROM draws WHERE lottery_id=? AND draw_date=? FOR UPDATE",
            [id, target.drawDate],
            connection,
          );
          if (existing) status = `มีงวด ${target.drawDate} แล้ว`;
          else {
            const [previous] = await query(
              "SELECT * FROM draws WHERE lottery_id=? AND draw_date<? ORDER BY draw_date DESC LIMIT 1 FOR UPDATE",
              [id, target.drawDate],
              connection,
            );
            if (!previousDrawReady(previous))
              status = `รอกรอกผลให้ครบสำหรับงวด ${String(previous.draw_date).slice(0, 10)}`;
            else {
              const inserted = await query(
                "INSERT INTO draws(lottery_id,draw_date,result_at) VALUES (?,?,?)",
                [id, target.drawDate, target.resultAt],
                connection,
              );
              createdId = inserted.insertId;
              status = `เปิดงวด ${target.drawDate} แล้ว`;
            }
          }
        } else if (schedule.config.enabled)
          status = "ไม่พบวันเปิดงวดตามตั้งค่า";
      }
      await query(
        "UPDATE lottery_draw_schedules SET last_checked_at=?,last_status=?,last_created_draw_id=COALESCE(?,last_created_draw_id) WHERE lottery_id=?",
        [now, status, createdId, id],
        connection,
      );
      await connection.commit();
      if (createdId) result.created.push({ lotteryId: id, drawId: createdId });
    } catch (error) {
      await connection.rollback();
      result.errors.push({ lotteryId: id, error: error.message });
      await query(
        "UPDATE lottery_draw_schedules SET last_checked_at=?,last_status=? WHERE lottery_id=?",
        [now, "ตรวจไม่สำเร็จ กรุณาตรวจบันทึกระบบ", id],
      );
    } finally {
      connection.release();
    }
  }
  if (result.created.length) await onCreated(result.created);
  return result;
}
