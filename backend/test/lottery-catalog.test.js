import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { db } from "../src/db.js";
import { bangkokToday } from "../src/lottery-catalog.js";
const enabled = process.env.RUN_INTEGRATION === "1";
test(
  "current-only results, paginated history, team sales and deletion preserve billing history",
  { skip: !enabled },
  async () => {
    const prefix = "catalog_" + randomBytes(6).toString("hex");
    const users = [],
      lotteries = [];
    const q = async (sql, args = []) => (await db.query(sql, args))[0];
    const api = async (path, token, body, method = body ? "POST" : "GET") => {
      const response = await fetch(
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
      return { status: response.status, data: await response.json() };
    };
    const password = "Catalog-test-password-123!";
    const hash = await bcrypt.hash(password, 4);
    async function user(role, leader = null) {
      const username = prefix + "_" + users.length;
      const result = await q(
        "INSERT INTO users(username,password,name,role,leader_id,expires_at,must_change) VALUES (?,?,?,?,?,?,0)",
        [
          username,
          hash,
          username,
          role,
          leader,
          new Date(Date.now() + 86400000 * 10),
        ],
      );
      users.push(result.insertId);
      const login = await api("/login", null, { username, password });
      assert.equal(login.status, 200);
      return { id: result.insertId, token: login.data.token };
    }
    try {
      const admin = await user("Admin"),
        leader = await user("Leader"),
        other = await user("Leader"),
        member = await user("Member", leader.id);
      const inserted = await q(
        "INSERT INTO lotteries(name,kind,enabled) VALUES (?,'หวยไทย',1)",
        [prefix],
      );
      const lottery = inserted.insertId;
      lotteries.push(lottery);
      const today = bangkokToday();
      const day = (offset) =>
        new Date(Date.parse(today + "T12:00:00+07:00") + offset * 86400000)
          .toISOString()
          .slice(0, 10);
      const drawIds = [];
      for (let i = -25; i <= 2; i++) {
        const inserted = await q(
          "INSERT INTO draws(lottery_id,draw_date,result_at,top3,top2,bottom2) VALUES (?,?,?,?,?,?)",
          [
            lottery,
            day(i),
            i < 0
              ? new Date(Date.now() - 86400000 * Math.abs(i))
              : new Date(Date.now() + 86400000 * (i + 1)),
            "123",
            "23",
            "45",
          ],
        );
        drawIds.push(inserted.insertId);
      }
      const current = drawIds[25],
        future = drawIds[26];
      const rates = {
        "2top": 95,
        "2bottom": 95,
        "3top": 900,
        "3tod": 150,
        runTop: 3,
        runBottom: 4,
      };
      const config = {
        rates,
        limit: 1000,
        blocked: [],
        half: [],
        closeTime: "23:59",
      };
      await q("INSERT INTO settings VALUES (?,?,?)", [
        leader.id,
        lottery,
        JSON.stringify(config),
      ]);
      const items = [
        {
          number: "23",
          type: "2top",
          amount: 100,
          rate: 95,
          currency: "THB",
          net: 100,
        },
      ];
      const bill = await q(
        "INSERT INTO bills(member_id,leader_id,draw_id,items,gross,net) VALUES (?,?,?,?,100,100)",
        [member.id, leader.id, drawIds[0], JSON.stringify(items)],
      );
      await q("INSERT INTO bill_discount_snapshots VALUES (?,?)", [
        bill.insertId,
        JSON.stringify({ "2top": 10 }),
      ]);
      let state = (await api("/state?view=results", member.token)).data;
      assert.equal(state.view, "results");
      assert.equal(
        state.draws.filter((d) => d.lottery_id === lottery).length,
        1,
      );
      assert.equal(
        state.draws.find((d) => d.lottery_id === lottery).id,
        current,
      );
      assert.equal(state.draws.find((d) => d.id === current).top3, null);
      assert.equal(state.bills.length, 0);
      assert.equal(state.usage.length, 0);
      assert.equal(
        (await api("/state?view=results", admin.token)).data.draws.find(
          (d) => d.id === current,
        ).top3,
        "123",
      );
      let history = await api(
        `/lotteries/${lottery}/history?exclude=${current}`,
        member.token,
      );
      assert.equal(history.status, 200);
      assert.equal(history.data.draws.length, 9);
      const seen = [...history.data.draws];
      while (history.data.nextBefore) {
        history = await api(
          `/lotteries/${lottery}/history?exclude=${current}&before=${history.data.nextBefore}`,
          member.token,
        );
        seen.push(...history.data.draws);
      }
      assert.equal(seen.length, 25);
      assert.equal(new Set(seen.map((d) => d.id)).size, 25);
      const range = await api(
        `/lotteries/${lottery}/history?from=${day(-7)}&to=${day(-3)}`,
        member.token,
      );
      assert.equal(range.data.draws.length, 5);
      assert.equal(
        (
          await api(
            `/lotteries/${lottery}/sales`,
            member.token,
            { selling: false },
            "PATCH",
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await api(
            `/lotteries/${lottery}/sales`,
            leader.token,
            { selling: "false" },
            "PATCH",
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await api(
            `/lotteries/${lottery}/sales`,
            leader.token,
            { selling: false },
            "PATCH",
          )
        ).status,
        200,
      );
      const saved = (
        await q(
          "SELECT config FROM settings WHERE leader_id=? AND lottery_id=?",
          [leader.id, lottery],
        )
      )[0].config;
      assert.equal(saved.selling, false);
      assert.deepEqual(saved.rates, rates);
      assert.ok(
        !(await api("/state?view=results", member.token)).data.lotteries.some(
          (l) => l.id === lottery,
        ),
      );
      assert.ok(
        (await api("/state?view=results", other.token)).data.lotteries.some(
          (l) => l.id === lottery,
        ),
        "other teams default to selling",
      );
      assert.equal(
        (await api(`/lotteries/${lottery}/history`, member.token)).status,
        404,
      );
      assert.equal(
        (
          await api("/bills", member.token, {
            draw_id: future,
            items: [{ number: "32", type: "2top", amount: 10 }],
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await api("/settings/" + lottery, leader.token, {
            ...config,
            closeAt: new Date().toISOString(),
            selling: true,
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await q(
            "SELECT config FROM settings WHERE leader_id=? AND lottery_id=?",
            [leader.id, lottery],
          )
        )[0].config.selling,
        false,
        "saving payout rates cannot reopen sales",
      );
      assert.equal(
        (
          await api(
            `/lotteries/${lottery}/sales`,
            leader.token,
            { selling: true },
            "PATCH",
          )
        ).status,
        200,
      );
      assert.ok(
        (await api("/state?view=results", member.token)).data.lotteries.some(
          (l) => l.id === lottery,
        ),
      );
      const submission = await api("/bills", member.token, {
        draw_id: future,
        items: [{ number: "32", type: "2top", amount: 10 }],
      });
      assert.equal(submission.status, 200, JSON.stringify(submission.data));
      assert.equal(
        (
          await api(
            `/lotteries/${lottery}`,
            leader.token,
            { confirm: true },
            "DELETE",
          )
        ).status,
        403,
      );
      assert.equal(
        (await api(`/lotteries/${lottery}`, admin.token, {}, "DELETE")).status,
        400,
      );
      assert.equal(
        (
          await api(
            `/lotteries/${lottery}`,
            admin.token,
            { confirm: true },
            "DELETE",
          )
        ).status,
        200,
      );
      assert.ok(
        !(await api("/state?view=results", admin.token)).data.lotteries.some(
          (l) => l.id === lottery,
        ),
      );
      assert.equal(
        (await api(`/lotteries/${lottery}/history`, admin.token)).status,
        404,
      );
      const retained = (await api("/state", member.token)).data.bills.find(
        (b) => b.id === bill.insertId,
      );
      assert.equal(retained.gross, 100);
      assert.equal(retained.net, 100);
      assert.equal(retained.win, 9500);
      assert.equal(retained.discountRates["2top"], 10);
      assert.equal(
        (
          await q("SELECT COUNT(*) n FROM draws WHERE lottery_id=?", [lottery])
        )[0].n,
        28,
      );
      assert.equal(
        (
          await api("/bills", member.token, {
            draw_id: future,
            items: [{ number: "32", type: "2top", amount: 10 }],
          })
        ).status,
        400,
      );
      // A type with only historical draws promotes its latest, without duplicating it in history.
      const past = await q(
        "INSERT INTO lotteries(name,kind) VALUES (?,'หวยนอก')",
        [prefix + "_past"],
      );
      lotteries.push(past.insertId);
      const old = [];
      for (let i = -2; i <= -1; i++)
        old.push(
          (
            await q(
              "INSERT INTO draws(lottery_id,draw_date,result_at) VALUES (?,?,?)",
              [past.insertId, day(i), new Date(Date.now() - 86400000)],
            )
          ).insertId,
        );
      const latest = (
        await api("/state?view=results", admin.token)
      ).data.draws.find((d) => d.lottery_id === past.insertId);
      assert.equal(latest.id, old[1]);
      assert.deepEqual(
        (
          await api(
            `/lotteries/${past.insertId}/history?exclude=${latest.id}`,
            admin.token,
          )
        ).data.draws.map((d) => d.id),
        [old[0]],
      );
    } finally {
      if (users.length) {
        await q("DELETE FROM bills WHERE member_id IN (?)", [users]);
        await q("DELETE FROM notifications WHERE user_id IN (?)", [users]);
        await q("DELETE FROM settings WHERE leader_id IN (?)", [users]);
        await q("DELETE FROM users WHERE id IN (?) AND role='Member'", [users]);
        await q("DELETE FROM users WHERE id IN (?)", [users]);
      }
      if (lotteries.length) {
        await q("DELETE FROM draws WHERE lottery_id IN (?)", [lotteries]);
        await q("DELETE FROM lotteries WHERE id IN (?)", [lotteries]);
      }
      await db.end();
    }
  },
);
if (!enabled) await db.end();
