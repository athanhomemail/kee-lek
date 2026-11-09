import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "../src/db.js";
import { runAutoDraws } from "../src/auto-draws.js";
const enabled = process.env.RUN_INTEGRATION === "1";
test(
  "automatic draws are idempotent across workers, preserve existing data and enforce previous results and Admin permissions",
  { skip: !enabled },
  async () => {
    const q = async (sql, args = []) => (await db.query(sql, args))[0];
    const name = "auto_" + randomBytes(6).toString("hex"),
      ids = [],
      users = [];
    const config = {
      enabled: true,
      mode: "weekdays",
      days: [1, 2, 3, 4, 5],
      resultTime: "20:00",
      resultDayOffset: 0,
    };
    const now = new Date("2026-11-09T09:00:00+07:00");
    const api = async (path, token, body, method = body ? "POST" : "GET") => {
      const r = await fetch(
        (process.env.TEST_API_URL || "http://127.0.0.1:4000/api") + path,
        {
          method,
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: "Bearer " + token } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        },
      );
      return { status: r.status, data: await r.json() };
    };
    try {
      async function lottery(suffix, rule = config) {
        const r = await q(
          "INSERT INTO lotteries(name,kind,enabled) VALUES (?,'หวยไทย',1)",
          [name + suffix],
        );
        ids.push(r.insertId);
        await q(
          "INSERT INTO lottery_draw_schedules(lottery_id,config) VALUES (?,?)",
          [r.insertId, JSON.stringify(rule)],
        );
        return r.insertId;
      }
      const id = await lottery("pending");
      const previous = (
        await q(
          "INSERT INTO draws(lottery_id,draw_date,result_at) VALUES (?,?,?)",
          [id, "2026-11-06", new Date("2026-11-06T20:00:00+07:00")],
        )
      ).insertId;
      assert.equal(
        (await runAutoDraws(db, { now, lotteryId: id })).created.length,
        0,
      );
      await q("UPDATE draws SET top3='000',top2='00' WHERE id=?", [previous]);
      assert.equal(
        (await runAutoDraws(db, { now, lotteryId: id })).created.length,
        0,
      );
      await q("UPDATE draws SET bottom2='00' WHERE id=?", [previous]);
      const concurrent = await Promise.all([
        runAutoDraws(db, { now, lotteryId: id }),
        runAutoDraws(db, { now, lotteryId: id }),
      ]);
      assert.equal(
        concurrent.reduce((n, r) => n + r.created.length, 0),
        1,
      );
      assert.equal(
        concurrent.reduce((n, r) => n + r.errors.length, 0),
        0,
      );
      const created = (
        await q("SELECT * FROM draws WHERE lottery_id=? AND draw_date=?", [
          id,
          "2026-11-09",
        ])
      )[0];
      assert.equal(created.top3, null);
      assert.equal(created.result_at.toISOString(), "2026-11-09T13:00:00.000Z");
      assert.equal(
        (await runAutoDraws(db, { now, lotteryId: id })).created.length,
        0,
      );
      assert.equal(
        (
          await runAutoDraws(db, {
            now: new Date("2026-11-10T09:00:00+07:00"),
            lotteryId: id,
          })
        ).created.length,
        0,
        "new pending draw blocks following draw",
      );
      assert.equal(
        (await q("SELECT top3 FROM draws WHERE id=?", [previous]))[0].top3,
        "000",
      );
      const manual = await lottery("manual");
      await q(
        "INSERT INTO draws(lottery_id,draw_date,result_at,top3,top2,bottom2) VALUES (?,?,?,?,?,?)",
        [
          manual,
          "2026-11-09",
          new Date("2026-11-09T21:00:00+07:00"),
          "123",
          "23",
          "45",
        ],
      );
      assert.equal(
        (await runAutoDraws(db, { now, lotteryId: manual })).created.length,
        0,
      );
      const retained = (
        await q("SELECT * FROM draws WHERE lottery_id=?", [manual])
      )[0];
      assert.equal(retained.top3, "123");
      assert.equal(
        retained.result_at.toISOString(),
        "2026-11-09T14:00:00.000Z",
      );
      const monthly = await lottery("monthly", {
        ...config,
        mode: "monthdays",
        days: [1, 16],
      });
      assert.equal(
        (await runAutoDraws(db, { now, lotteryId: monthly })).created.length,
        1,
      );
      assert.equal(
        (
          await q("SELECT draw_date FROM draws WHERE lottery_id=?", [monthly])
        )[0].draw_date,
        "2026-11-16",
      );
      const closed = await lottery("closed");
      await q("UPDATE lotteries SET enabled=0 WHERE id=?", [closed]);
      assert.equal(
        (await runAutoDraws(db, { now, lotteryId: closed })).created.length,
        0,
      );
      await q("UPDATE lotteries SET enabled=1,deleted_at=NOW() WHERE id=?", [
        closed,
      ]);
      assert.equal(
        (await runAutoDraws(db, { now, lotteryId: closed })).created.length,
        0,
      );
      const future = await lottery("future");
      await q(
        "INSERT INTO draws(lottery_id,draw_date,result_at,top3,top2,bottom2) VALUES (?,?,?,?,?,?)",
        [
          future,
          "2026-11-08",
          new Date("2026-11-10T01:00:00+07:00"),
          "123",
          "23",
          "45",
        ],
      );
      assert.equal(
        (await runAutoDraws(db, { now, lotteryId: future })).created.length,
        1,
      );
      // Permission and validation checks; API fixtures stay disabled to avoid wall-clock job interference.
      const password = "Auto-test-password-123!",
        hash = await bcrypt.hash(password, 4);
      const tokens = {};
      for (const role of ["Admin", "Leader"]) {
        const r = await q(
          "INSERT INTO users(username,password,name,role,expires_at,must_change) VALUES (?,?,?,?,?,0)",
          [name + role, hash, name, role, new Date(Date.now() + 86400000)],
        );
        users.push(r.insertId);
        tokens[role] = (
          await api("/login", null, { username: name + role, password })
        ).data.token;
      }
      const apiId = await lottery("api", { ...config, enabled: false });
      assert.equal((await api("/draw-schedules", tokens.Leader)).status, 403);
      assert.equal(
        (
          await api(
            "/draw-schedules/" + apiId,
            tokens.Leader,
            { ...config, enabled: false },
            "PUT",
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await api(
            "/draw-schedules/" + apiId,
            tokens.Admin,
            { ...config, days: [] },
            "PUT",
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await api(
            "/draw-schedules/" + apiId,
            tokens.Admin,
            { ...config, enabled: false },
            "PUT",
          )
        ).status,
        200,
      );
      const backup = (await api("/maintenance/backup", tokens.Admin)).data;
      assert.ok(
        backup.tables.lottery_draw_schedules.some(
          (row) => row.lottery_id === apiId,
        ),
        "Admin backup includes saved schedules",
      );
      const rows = (await api("/draw-schedules", tokens.Admin)).data;
      assert.equal(
        rows.find((r) => r.lottery_id === apiId).config.enabled,
        false,
      );
      assert.equal(
        (await q("SELECT COUNT(*) n FROM draws WHERE lottery_id=?", [apiId]))[0]
          .n,
        0,
      );
    } finally {
      if (ids.length) {
        await q("DELETE FROM lottery_draw_schedules WHERE lottery_id IN (?)", [
          ids,
        ]);
        await q("DELETE FROM draws WHERE lottery_id IN (?)", [ids]);
        await q("DELETE FROM lotteries WHERE id IN (?)", [ids]);
      }
      if (users.length) await q("DELETE FROM users WHERE id IN (?)", [users]);
      await db.end();
    }
  },
);
if (!enabled) await db.end();
