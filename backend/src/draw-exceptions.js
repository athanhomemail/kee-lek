import { bangkokToday } from "./lottery-catalog.js";
export function validDrawDate(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value >= "1000-01-01" &&
    value <= "9999-12-31" &&
    Number.isFinite(Date.parse(value + "T00:00:00Z")) &&
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value
  );
}
export function validateDrawExceptions(input = []) {
  if (!Array.isArray(input) || input.length > 1000)
    throw Error("รายการข้อยกเว้นไม่ถูกต้อง (สูงสุด 1,000 รายการ)");
  const dates = new Set(),
    targets = new Set();
  const result = input.map((row) => {
    if (
      !row ||
      !validDrawDate(row.date) ||
      !["move", "skip"].includes(row.action) ||
      dates.has(row.date)
    )
      throw Error("วันงวดเดิมหรือประเภทข้อยกเว้นไม่ถูกต้อง / วันซ้ำ");
    dates.add(row.date);
    const clean = {
      date: row.date,
      action: row.action,
      note: String(row.note || "").slice(0, 200),
    };
    if (row.action === "move") {
      if (
        !validDrawDate(row.toDate) ||
        row.toDate === row.date ||
        targets.has(row.toDate)
      )
        throw Error("วันเลื่อนงวดไม่ถูกต้องหรือชนกับข้อยกเว้นอื่น");
      targets.add(row.toDate);
      clean.toDate = row.toDate;
      if (row.resultTime) {
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(row.resultTime))
          throw Error("เวลาเผยแพร่ผลไม่ถูกต้อง");
        clean.resultTime = row.resultTime;
      }
      if (
        row.resultDayOffset !== undefined &&
        row.resultDayOffset !== null &&
        row.resultDayOffset !== ""
      ) {
        if (
          !Number.isInteger(row.resultDayOffset) ||
          row.resultDayOffset < 0 ||
          row.resultDayOffset > 7
        )
          throw Error("วันเลื่อนเผยแพร่ผลต้องเป็น 0–7");
        clean.resultDayOffset = row.resultDayOffset;
      }
    }
    return clean;
  });
  for (const target of targets)
    if (dates.has(target))
      throw Error(
        "วันปลายทางซ้อนกับวันเดิมของข้อยกเว้นอื่น กรุณาแยกวันที่ให้ชัดเจน",
      );
  return result.sort((a, b) => a.date.localeCompare(b.date));
}
export function setDrawException(config, exception) {
  return {
    ...config,
    exceptions: validateDrawExceptions([
      ...(config.exceptions || []).filter((row) => row.date !== exception.date),
      exception,
    ]),
  };
}
export function manualSkipException(config, date) {
  // If a moved draw is deleted, suppress both its original date and its new date.
  const exceptions = (config.exceptions || [])
    .map((row) =>
      row.action === "move" && row.toDate === date
        ? { date: row.date, action: "skip", note: "ลบงวดแบบ manual" }
        : row,
    )
    .filter((row) => row.date !== date);
  return {
    ...config,
    exceptions: validateDrawExceptions([
      ...exceptions,
      { date, action: "skip", note: "ลบงวดแบบ manual" },
    ]),
  };
}
export function resultDateTime(drawDate, time, offset = 0) {
  const date = new Date(drawDate + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + offset);
  return new Date(`${date.toISOString().slice(0, 10)}T${time}:00+07:00`);
}
export function manualMoveException(config, fromDate, toDate, resultAt) {
  const original =
    (config.exceptions || []).find(
      (row) => row.action === "move" && row.toDate === fromDate,
    )?.date || fromDate;
  const local = new Date(
    new Date(resultAt).getTime() + 7 * 3600000,
  ).toISOString();
  const offset = Math.round(
    (Date.parse(local.slice(0, 10) + "T00:00:00Z") -
      Date.parse(toDate + "T00:00:00Z")) /
      86400000,
  );
  const exceptions = (config.exceptions || []).filter(
    (row) => row.date !== original,
  );
  if (original === toDate) return { ...config, exceptions };
  return setDrawException(
    { ...config, exceptions },
    {
      date: original,
      action: "move",
      toDate,
      resultTime: local.slice(11, 16),
      resultDayOffset: offset,
      note: "เลื่อนงวดแบบ manual",
    },
  );
}
export async function moveExistingDraw(connection, draw, toDate, resultAt) {
  if (draw.top3 || draw.top2 || draw.bottom2)
    throw Error("งวดมีการกรอกผลแล้ว ไม่สามารถเลื่อนงวดได้");
  const [conflicts] = await connection.query(
    "SELECT id FROM draws WHERE lottery_id=? AND draw_date=? AND id<>? FOR UPDATE",
    [draw.lottery_id, toDate, draw.id],
  );
  if (conflicts.length)
    throw Error("วันปลายทางมีงวดอยู่แล้ว ไม่สามารถรวมงวดหรือย้ายโพยทับกันได้");
  const delta =
    Date.parse(toDate + "T00:00:00Z") -
    Date.parse(String(draw.draw_date).slice(0, 10) + "T00:00:00Z");
  await connection.query(
    "UPDATE draws SET draw_date=?,result_at=? WHERE id=?",
    [toDate, resultAt, draw.id],
  );
  const [rules] = await connection.query(
    "SELECT leader_id,config FROM draw_settings WHERE draw_id=? FOR UPDATE",
    [draw.id],
  );
  for (const rule of rules)
    if (
      rule.config.closeAt &&
      Number.isFinite(Date.parse(rule.config.closeAt))
    ) {
      await connection.query(
        "UPDATE draw_settings SET config=JSON_SET(config,'$.closeAt',?) WHERE leader_id=? AND draw_id=?",
        [
          new Date(Date.parse(rule.config.closeAt) + delta).toISOString(),
          rule.leader_id,
          draw.id,
        ],
      );
    }
}
export async function saveDrawException(
  database,
  lotteryId,
  input,
  { now = new Date(), defaults } = {},
) {
  if (
    !validDrawDate(input?.date) ||
    !["move", "skip", "restore"].includes(input.action)
  )
    throw Error("กรุณาระบุวันงวดและข้อยกเว้น");
  const connection = await database.getConnection();
  try {
    await connection.beginTransaction();
    const [[lottery]] = await connection.query(
      "SELECT id FROM lotteries WHERE id=? AND deleted_at IS NULL FOR UPDATE",
      [lotteryId],
    );
    if (!lottery) throw Error("ไม่พบประเภทหวย");
    const [[stored]] = await connection.query(
      "SELECT config FROM lottery_draw_schedules WHERE lottery_id=? FOR UPDATE",
      [lotteryId],
    );
    const config = { ...defaults, ...stored?.config };
    const previous = (config.exceptions || []).find(
      (row) => row.date === input.date,
    );
    const sourceDate =
      previous?.action === "move" ? previous.toDate : input.date;
    const [[source]] = await connection.query(
      "SELECT * FROM draws WHERE lottery_id=? AND draw_date=? FOR UPDATE",
      [lotteryId, sourceDate],
    );
    let next;
    if (input.action === "restore") {
      if (!previous) throw Error("ไม่พบข้อยกเว้น");
      next = {
        ...config,
        exceptions: (config.exceptions || []).filter(
          (row) => row.date !== input.date,
        ),
      };
      if (source && previous.action === "move") {
        if (!config.resultTime)
          throw Error("กรุณาตั้งเวลาเผยแพร่ผลตามตารางหลักก่อนคืนวันเดิม");
        const resultAt = resultDateTime(
          input.date,
          config.resultTime,
          config.resultDayOffset,
        );
        if (input.date < bangkokToday(now) || resultAt <= now)
          throw Error("วันเดิมผ่านไปแล้ว ไม่สามารถคืนงวดไปในอดีตได้");
        await moveExistingDraw(connection, source, input.date, resultAt);
      }
    } else {
      const [exception] = validateDrawExceptions([input]);
      next = setDrawException(config, exception);
      if (exception.action === "skip") {
        if (source) {
          const [[count]] = await connection.query(
            "SELECT COUNT(*) n FROM bills WHERE draw_id=?",
            [source.id],
          );
          if (count.n || source.top3 || source.top2 || source.bottom2)
            throw Error(
              "ข้ามงวดที่มีโพยหรือผลแล้วไม่ได้ ให้ใช้เลื่อนงวดเพื่อรักษาประวัติ",
            );
          await connection.query("DELETE FROM draw_settings WHERE draw_id=?", [
            source.id,
          ]);
          await connection.query("DELETE FROM draws WHERE id=?", [source.id]);
        }
      } else {
        const time = exception.resultTime || config.resultTime;
        if (!time) throw Error("กรุณาระบุเวลาเผยแพร่ผล");
        const resultAt = resultDateTime(
          exception.toDate,
          time,
          exception.resultDayOffset ?? config.resultDayOffset,
        );
        if (exception.toDate < bangkokToday(now) || resultAt <= now)
          throw Error("วันและเวลาเผยแพร่ของงวดใหม่ต้องยังไม่ผ่าน");
        if (source)
          await moveExistingDraw(
            connection,
            source,
            exception.toDate,
            resultAt,
          );
      }
    }
    await connection.query(
      "INSERT INTO lottery_draw_schedules(lottery_id,config) VALUES (?,?) ON DUPLICATE KEY UPDATE config=VALUES(config)",
      [lotteryId, JSON.stringify(next)],
    );
    await connection.commit();
    return next;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
