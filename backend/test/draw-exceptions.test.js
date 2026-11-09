import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "../src/db.js";
import { saveDrawException } from "../src/draw-exceptions.js";
import { runAutoDraws, defaultDrawSchedule } from "../src/auto-draws.js";
const enabled = process.env.RUN_INTEGRATION === "1";
test(
  "all lottery kinds support moved and skipped rounds without recreating originals or changing bill amounts",
  { skip: !enabled },
  async () => {
    const q = async (sql, args = []) => (await db.query(sql, args))[0],
      ids = [],
      users = [];
    const prefix = "exception_" + randomBytes(5).toString("hex");
    const now = new Date("2026-11-09T09:00:00+07:00");
    const api = async (path, token, body, method = body ? "POST" : "GET") => {
      const r = await fetch(
        (process.env.TEST_API_URL || "http://127.0.0.1:4000/api") + path,
        {
          method,
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token,
          },
          body: body ? JSON.stringify(body) : undefined,
        },
      );
      return { status: r.status, data: await r.json() };
    };
    try {
      const leader = (
        await q(
          "INSERT INTO users(username,password,name,role,expires_at,must_change) VALUES (?,?,?,'Leader',?,0)",
          [
            prefix + "leader",
            "unused",
            "Leader",
            new Date(Date.now() + 86400000),
          ],
        )
      ).insertId;
      users.push(leader);
      const member = (
        await q(
          "INSERT INTO users(username,password,name,role,leader_id,must_change) VALUES (?,?,?,'Member',?,0)",
          [prefix + "member", "unused", "Member", leader],
        )
      ).insertId;
      users.push(member);
      const config = {
        ...defaultDrawSchedule,
        enabled: true,
        mode: "monthdays",
        days: [1, 16],
        resultTime: "16:00",
      };
      const lottery = async (kind = "หวยไทย") => {
        const id = (
          await q("INSERT INTO lotteries(name,kind) VALUES (?,?)", [
            prefix + ids.length,
            kind,
          ])
        ).insertId;
        ids.push(id);
        await q(
          "INSERT INTO lottery_draw_schedules(lottery_id,config) VALUES (?,?)",
          [id, JSON.stringify(config)],
        );
        return id;
      };
      const id = await lottery();
      const draw = (
        await q(
          "INSERT INTO draws(lottery_id,draw_date,result_at) VALUES (?,?,?)",
          [id, "2026-11-16", new Date("2026-11-16T16:00:00+07:00")],
        )
      ).insertId;
      const bill = (
        await q(
          "INSERT INTO bills(member_id,leader_id,draw_id,items,gross,net) VALUES (?,?,?,?,100,100)",
          [
            member,
            leader,
            draw,
            JSON.stringify([
              {
                number: "12",
                type: "2top",
                amount: 100,
                rate: 95,
                currency: "THB",
              },
            ]),
          ],
        )
      ).insertId;
      await q("INSERT INTO bill_discount_snapshots VALUES (?,?)", [
        bill,
        JSON.stringify({ "2top": 10 }),
      ]);
      await q("INSERT INTO draw_settings VALUES (?,?,?)", [
        leader,
        draw,
        JSON.stringify({
          closeAt: "2026-11-16T14:00:00+07:00",
          blocked: ["99"],
        }),
      ]);
      await saveDrawException(
        db,
        id,
        {
          date: "2026-11-16",
          action: "move",
          toDate: "2026-11-17",
          resultTime: "16:00",
          resultDayOffset: 0,
        },
        { now, defaults: defaultDrawSchedule },
      );
      assert.equal(
        (await q("SELECT draw_date FROM draws WHERE id=?", [draw]))[0]
          .draw_date,
        "2026-11-17",
      );
      const retained = (await q("SELECT * FROM bills WHERE id=?", [bill]))[0];
      assert.equal(retained.draw_id, draw);
      assert.equal(retained.gross, 100);
      assert.equal(retained.items[0].rate, 95);
      assert.equal(
        (
          await q("SELECT rates FROM bill_discount_snapshots WHERE bill_id=?", [
            bill,
          ])
        )[0].rates["2top"],
        10,
      );
      const rules = (
        await q("SELECT config FROM draw_settings WHERE draw_id=?", [draw])
      )[0].config;
      assert.equal(rules.closeAt, "2026-11-17T07:00:00.000Z");
      assert.deepEqual(rules.blocked, ["99"]);
      for (let i = 0; i < 2; i++)
        assert.equal(
          (await runAutoDraws(db, { lotteryId: id, now })).created.length,
          0,
        );
      assert.equal(
        (
          await q(
            "SELECT COUNT(*) n FROM draws WHERE lottery_id=? AND draw_date=?",
            [id, "2026-11-16"],
          )
        )[0].n,
        0,
      );
      await saveDrawException(
        db,
        id,
        { date: "2026-11-16", action: "restore" },
        { now, defaults: defaultDrawSchedule },
      );
      assert.equal(
        (await q("SELECT draw_date FROM draws WHERE id=?", [draw]))[0]
          .draw_date,
        "2026-11-16",
      );
      await assert.rejects(
        () =>
          saveDrawException(
            db,
            id,
            { date: "2026-11-16", action: "skip" },
            { now, defaults: defaultDrawSchedule },
          ),
        /มีโพย/,
      );
      await q("UPDATE draws SET top3='123' WHERE id=?", [draw]);
      await assert.rejects(
        () =>
          saveDrawException(
            db,
            id,
            { date: "2026-11-16", action: "move", toDate: "2026-11-17" },
            { now, defaults: defaultDrawSchedule },
          ),
        /กรอกผล/,
      );
      for (const kind of ["หวยไทย", "หวยนอก"]) {
        const type = await lottery(kind);
        await saveDrawException(
          db,
          type,
          { date: "2026-11-16", action: "move", toDate: "2026-11-17" },
          { now, defaults: defaultDrawSchedule },
        );
        assert.equal(
          (await runAutoDraws(db, { lotteryId: type, now })).created.length,
          1,
        );
        assert.equal(
          (await q("SELECT draw_date FROM draws WHERE lottery_id=?", [type]))[0]
            .draw_date,
          "2026-11-17",
        );
      }
      const manual = await lottery("หวยนอก");
      await q(
        "INSERT INTO draws(lottery_id,draw_date,result_at) VALUES (?,?,?)",
        [manual, "2026-11-17", new Date("2026-11-17T20:00:00+07:00")],
      );
      await saveDrawException(
        db,
        manual,
        { date: "2026-11-16", action: "move", toDate: "2026-11-17" },
        { now, defaults: defaultDrawSchedule },
      );
      assert.equal(
        (await runAutoDraws(db, { lotteryId: manual, now })).created.length,
        0,
      );
      assert.equal(
        (
          await q("SELECT COUNT(*) n FROM draws WHERE lottery_id=?", [manual])
        )[0].n,
        1,
      );
      const conflict = await lottery();
      for (const day of [16, 17])
        await q(
          "INSERT INTO draws(lottery_id,draw_date,result_at) VALUES (?,?,?)",
          [
            conflict,
            `2026-11-${day}`,
            new Date(`2026-11-${day}T16:00:00+07:00`),
          ],
        );
      await assert.rejects(
        () =>
          saveDrawException(
            db,
            conflict,
            { date: "2026-11-16", action: "move", toDate: "2026-11-17" },
            { now, defaults: defaultDrawSchedule },
          ),
        /มีงวดอยู่แล้ว/,
      );
      assert.equal(
        (
          await q("SELECT COUNT(*) n FROM draws WHERE lottery_id=?", [conflict])
        )[0].n,
        2,
      );
      const skipped = await lottery();
      await saveDrawException(
        db,
        skipped,
        { date: "2026-11-16", action: "skip" },
        { now, defaults: defaultDrawSchedule },
      );
      await runAutoDraws(db, { lotteryId: skipped, now });
      assert.equal(
        (
          await q("SELECT draw_date FROM draws WHERE lottery_id=?", [skipped])
        )[0].draw_date,
        "2026-12-01",
      );
      const password = "Exception-test-password-123!",
        admin = (
          await q(
            "INSERT INTO users(username,password,name,role,must_change) VALUES (?,?,?,'Admin',0)",
            [prefix + "admin", await bcrypt.hash(password, 4), "Admin"],
          )
        ).insertId;
      users.push(admin);
      const token = (
        await api("/login", "", { username: prefix + "admin", password })
      ).data.token;
      const endpoint = await lottery();
      await q("UPDATE lottery_draw_schedules SET config=? WHERE lottery_id=?", [
        JSON.stringify({ ...config, enabled: false }),
        endpoint,
      ]);
      const original = (
        await q(
          "INSERT INTO draws(lottery_id,draw_date,result_at) VALUES (?,?,?)",
          [endpoint, "2026-11-16", new Date("2026-11-16T16:00:00+07:00")],
        )
      ).insertId;
      assert.equal(
        (
          await api(
            "/draws/" + original,
            token,
            { draw_date: "2026-11-17", result_at: "2026-11-17T16:00" },
            "PUT",
          )
        ).status,
        200,
      );
      assert.equal(
        (
          await q(
            "SELECT config FROM lottery_draw_schedules WHERE lottery_id=?",
            [endpoint],
          )
        )[0].config.exceptions[0].date,
        "2026-11-16",
      );
      assert.equal(
        (
          await api(
            "/draw-schedules/" + endpoint,
            token,
            { ...config, enabled: false },
            "PUT",
          )
        ).status,
        200,
        "old clients may save schedule without erasing exceptions",
      );
      assert.equal(
        (
          await q(
            "SELECT config FROM lottery_draw_schedules WHERE lottery_id=?",
            [endpoint],
          )
        )[0].config.exceptions.length,
        1,
      );
      assert.equal(
        (await api("/draws/" + original, token, null, "DELETE")).status,
        200,
      );
      const suppressed = (
        await q(
          "SELECT config FROM lottery_draw_schedules WHERE lottery_id=?",
          [endpoint],
        )
      )[0].config.exceptions;
      assert.deepEqual(
        suppressed.map((r) => [r.date, r.action]),
        [
          ["2026-11-16", "skip"],
          ["2026-11-17", "skip"],
        ],
      );
      assert.equal(
        (
          await api("/draws", token, {
            lottery_id: endpoint,
            draw_date: "2026-11-16",
            result_at: "2026-11-16T16:00",
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await api("/draw-schedules/" + endpoint + "/exceptions", token, {
            date: "2026-11-18",
            action: "skip",
          })
        ).status,
        200,
      );
    } finally {
      if (ids.length) {
        const draws = await q("SELECT id FROM draws WHERE lottery_id IN (?)", [
          ids,
        ]);
        if (draws.length) {
          const drawIds = draws.map((d) => d.id);
          await q("DELETE FROM bills WHERE draw_id IN (?)", [drawIds]);
          await q("DELETE FROM draw_settings WHERE draw_id IN (?)", [drawIds]);
        }
        await q("DELETE FROM lottery_draw_schedules WHERE lottery_id IN (?)", [
          ids,
        ]);
        await q("DELETE FROM draws WHERE lottery_id IN (?)", [ids]);
        await q("DELETE FROM lotteries WHERE id IN (?)", [ids]);
      }
      if (users.length) {
        await q("DELETE FROM users WHERE id IN (?) AND role='Member'", [users]);
        await q("DELETE FROM users WHERE id IN (?)", [users]);
      }
      await db.end();
    }
  },
);
if (!enabled) await db.end();
