import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { db } from "../src/db.js";
const enabled = process.env.RUN_INTEGRATION === "1";
test(
  "API advisory discounts, full-price accounting, authorization, concurrency and editing",
  { skip: !enabled },
  async () => {
    const root = "test_" + randomBytes(6).toString("hex"),
      password = "Test-only-password-123!";
    let admin, leader, member1, member2, lottery, draw;
    async function api(path, token, body, method = body ? "POST" : "GET") {
      const r = await fetch((process.env.TEST_API_URL || "http://127.0.0.1:4000/api") + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: "Bearer " + token } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const raw = await r.text();
      let data;
      try { data = JSON.parse(raw); } catch { data = { error: raw }; }
      return { status: r.status, data, cacheControl: r.headers.get("cache-control") };
    }
    async function login(username, pw = password) {
      const r = await api("/login", null, { username, password: pw });
      assert.equal(r.status, 200, JSON.stringify(r.data));
      return r.data.token;
    }
    async function q(sql, args = []) {
      return (await db.query(sql, args))[0];
    }
    try {
      const ins = await q(
        "INSERT INTO users(username,password,name,role,must_change) VALUES (?,?,?,'Admin',0)",
        [root, await bcrypt.hash(password, 4), "Integration admin"],
      );
      admin = ins.insertId;
      const a = await login(root);
      const expires = new Date(
        Math.floor((Date.now() + 86400000) / 1000) * 1000,
      ).toISOString();
      let r = await api("/users", a, {
        name: "Integration leader",
        phone: "0800000000",
        expires_at: expires,
      });
      assert.equal(r.status, 200);
      let creds = r.data;
      const l = await login(creds.username, creds.password);
      leader = (await api("/me", l)).data.id;
      assert.equal(
        (await api("/state", l)).status,
        403,
        "first password change enforced",
      );
      assert.equal(
        (await api("/password", l, { current: creds.password, password }))
          .status,
        200,
      );
      assert.equal((await api("/report-exchange", a, { rate: 650 })).status, 403);
      for (const rate of [0, -1, "650", null])
        assert.equal((await api("/report-exchange", l, { rate })).status, 400);
      assert.equal((await api("/report-exchange", l, { rate: 650 })).status, 200);
      const exchange = (await api("/state", l)).data.exchangeRates;
      assert.equal(exchange.length, 1);
      assert.equal(Number(exchange[0].rate), 650);
      assert.equal(Number(exchange[0].leader_id), Number(leader));
      const members = [];
      for (let n = 0; n < 2; n++) {
        r = await api("/users", l, {
          name: "Integration member " + n,
          phone: "0800000000",
        });
        assert.equal(r.status, 200);
        const m = await login(r.data.username, r.data.password);
        await api("/password", m, { current: r.data.password, password });
        const id = (await api("/me", m)).data.id;
        members.push({ token: m, id });
        assert.equal((await api("/users/" + id, l, { amount: 5000 }, "PATCH")).status, 403);
      }
      [member1, member2] = members.map((m) => m.id);
      assert.equal((await api(`/users/${member1}/password`, members[0].token)).status, 403);
      assert.equal((await api(`/users/${member1}/password`, a)).status, 403);
      assert.equal((await api(`/users/${leader}/password`, l)).status, 403);
      let viewed = await api(`/users/${member1}/password`, l);
      assert.equal(viewed.status, 200);
      assert.equal(viewed.cacheControl, "no-store");
      assert.equal(viewed.data.password, password);
      assert.equal((await api(`/users/${leader}/password`, a)).data.password, password);
      const stored = (await q("SELECT password_cipher FROM users WHERE id=?", [member1]))[0].password_cipher;
      assert.notEqual(stored, password);
      const profile = (await api("/state", l)).data;
      assert.equal(profile.user.password_cipher, undefined);
      const beforeProfile = (await api("/me", members[0].token)).data;
      const beforeHash = (await q("SELECT password FROM users WHERE id=?", [member1]))[0].password;
      let editedProfile = await api("/me", members[0].token, { name: "  Updated member  ", phone: " 0801234567 ", role: "Admin", id: leader, active: false, username: "changed", password: "changed" }, "PATCH");
      assert.equal(editedProfile.status, 200);
      assert.equal(editedProfile.data.user.id, member1);
      assert.equal(editedProfile.data.user.name, "Updated member");
      assert.equal(editedProfile.data.user.phone, "0801234567");
      assert.equal(editedProfile.data.user.role, "Member");
      assert.equal(editedProfile.data.user.username, beforeProfile.username);
      assert.equal(editedProfile.data.user.leader_id, leader);
      assert.equal(editedProfile.data.user.active, 1);
      assert.equal(editedProfile.data.user.password, undefined);
      assert.equal(editedProfile.data.user.password_cipher, undefined);
      assert.equal((await q("SELECT password FROM users WHERE id=?", [member1]))[0].password, beforeHash);
      for (const body of [{name:" ",phone:""},{name:"x".repeat(151),phone:""},{name:"Valid",phone:"abc"}])
        assert.equal((await api("/me", members[0].token, body, "PATCH")).status, 400);
      assert.equal((await api("/me", l, {name:"Updated leader",phone:""},"PATCH")).status,200);
      assert.equal((await api("/me",a,{name:"Updated admin",phone:"0809999999"},"PATCH")).status,200);
      assert.equal((await api("/state",l)).data.users.find((user)=>user.id===member1).name,"Updated member");
      assert.equal((await api("/state",a)).data.users.find((user)=>user.id===leader).name,"Updated leader");

      assert.ok(profile.users.every((user) => user.password_cipher === undefined && user.password === undefined));
      await q("UPDATE users SET password_cipher=NULL WHERE id=?", [member2]);
      const legacy = await api(`/users/${member2}/password`, l);
      assert.equal(legacy.data.available, false);
      const member2Name = (await q("SELECT username FROM users WHERE id=?", [member2]))[0].username;
      await login(member2Name);
      viewed = await api(`/users/${member2}/password`, l);
      assert.equal(viewed.data.password, password);
      assert.equal((await api("/me", members[1].token)).data.must_change, 0);

      assert.equal((await api("/state", a)).data.accessExpiresAt, null);
      assert.equal((await api("/state", l)).data.accessExpiresAt, expires);
      assert.equal(
        (await api("/state", members[0].token)).data.accessExpiresAt,
        expires,
      );
      assert.equal((await api("/maintenance", l)).status, 403);
      assert.equal(
        (await api("/maintenance/backup", members[0].token)).status,
        403,
      );
      assert.equal(
        (await api("/maintenance/clear", members[0].token, { mode: "fresh" }))
          .status,
        403,
      );
      const maintenance = await api("/maintenance", a);
      assert.equal(maintenance.status, 200);
      assert.ok(maintenance.data.counts.users >= 3);
      assert.equal(
        (
          await api("/maintenance/clear", a, {
            mode: "bills",
            password,
            confirmation: "wrong",
            backupConfirmed: true,
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await api("/maintenance/clear", a, {
            mode: "bills",
            password: "wrong",
            confirmation: "ล้างโพยทั้งหมด",
            backupConfirmed: true,
          })
        ).status,
        400,
      );
      const extended = new Date(
        Math.floor((Date.now() + 5 * 86400000) / 1000) * 1000,
      ).toISOString();
      assert.equal(
        (
          await api(
            "/users/" + leader,
            a,
            { expires_at: extended, active: true },
            "PATCH",
          )
        ).status,
        200,
      );
      assert.equal(
        (await api("/state", members[0].token)).data.accessExpiresAt,
        extended,
      );
      assert.equal(
        (
          await api(
            "/users/" + leader,
            a,
            { expires_at: extended, active: false },
            "PATCH",
          )
        ).status,
        200,
      );
      assert.equal((await api("/state", members[0].token)).status, 401);
      assert.equal(
        (
          await api(
            "/users/" + leader,
            a,
            { expires_at: extended, active: true },
            "PATCH",
          )
        ).status,
        200,
      );

      const lr = await q(
        "INSERT INTO lotteries(name,kind,flag,enabled) VALUES (?,'หวยไทย','T',1)",
        [root],
      );
      lottery = lr.insertId;
      const dr = await q(
        "INSERT INTO draws(lottery_id,draw_date,result_at) VALUES (?,CURDATE(),?)",
        [lottery, new Date(Date.now() + 86400000)],
      );
      draw = dr.insertId;
      const settings = {
        limit: 1000,
        discount: 0,
        rates: {
          "2top": 95,
          "2bottom": 95,
          "3top": 900,
          "3tod": 150,
          runTop: 3,
          runBottom: 4,
        },
        discounts: {
          "2top": 10,
          "2bottom": 10,
          "3top": 0,
          "3tod": 0,
          runTop: 0,
          runBottom: 0,
        },
        blocked: [],
        half: [],
        closeAt: new Date().toISOString(),
      };
      assert.equal(
        (await api("/settings/" + lottery, l, settings)).status,
        200,
      );
      assert.equal(
        (
          await api("/draw-settings/" + draw, l, {
            closeAt: new Date(Date.now() + 3600000).toISOString(),
            blocked: ["99"],
            half: ["01"],
          })
        ).status,
        200,
      );
      const discountRates = {
        "2top": 10,
        "2bottom": 5,
        "3top": 20,
        "3tod": 3,
        runTop: 1,
        runBottom: 0,
      };
      const discountBody = {
        memberIds: [member1, member2],
        lotteryId: lottery,
        rates: discountRates,
      };
      assert.equal(
        (await api("/member-discounts", members[0].token, discountBody)).status,
        403,
      );
      assert.equal(
        (await api("/member-discounts", a, discountBody)).status,
        403,
      );
      assert.equal(
        (
          await api("/member-discounts", l, {
            ...discountBody,
            memberIds: [member1, admin],
          })
        ).status,
        400,
      );
      assert.equal(
        (await api("/state", l)).data.memberDiscounts.length,
        0,
        "invalid bulk update is atomic",
      );
      assert.equal(
        (await api("/member-discounts", l, discountBody)).status,
        200,
      );
      assert.equal((await api("/state", l)).data.memberDiscounts.length, 2);
      assert.equal(
        (await api("/state", members[0].token)).data.memberDiscounts.length,
        1,
      );
      assert.equal(
        (
          await api("/settings/" + lottery, l, {
            ...settings,
            lak: { rates: settings.rates, limit: 1000, limits: Object.fromEntries(Object.keys(settings.rates).map(k => [k,1000])) },
          })
        ).status,
        200,
      );
      const kipBill = {
        draw_id: draw,
        currency: "LAK",
        items: [{ number: "23", type: "2top", amount: 12.5 }],
      };
      const kipResponse = await api("/bills", members[0].token, kipBill);
      assert.equal(kipResponse.status, 200, JSON.stringify(kipResponse.data));
      const kipRecord = (await api("/state", members[0].token)).data.bills.find(
        (b) => b.id === kipResponse.data.id,
      );
      assert.equal(kipRecord.currency, "LAK");
      assert.equal(kipRecord.net, 12.5);
      assert.deepEqual(kipRecord.discountRates, discountRates);
      // Simulate a legacy bill: no snapshot must remain zero even when edited.
      await q("DELETE FROM bill_discount_snapshots WHERE bill_id=?", [
        kipRecord.id,
      ]);
      assert.equal(
        (await api("/bills/" + kipRecord.id, members[0].token, kipBill)).status,
        200,
      );
      assert.deepEqual(
        (await api("/state", members[0].token)).data.bills.find(
          (b) => b.id === kipRecord.id,
        ).discountRates,
        {},
      );
      const bill = {
        draw_id: draw,
        items: [
          { number: "32", type: "2top", amount: 100 },
          { number: "323", type: "3top", amount: 200 },
        ],
      };
      r = await api("/bills", members[0].token, bill);
      assert.equal(r.status, 200, JSON.stringify(r.data));
      const billId = r.data.id;
      assert.equal((await api("/me", members[0].token)).data.credit, undefined);
      const recorded = (await api("/state", members[0].token)).data.bills.find((b) => b.id === billId);
      assert.deepEqual(recorded.discountRates, discountRates);
      assert.equal(
        (
          await api("/member-discounts", l, {
            ...discountBody,
            memberIds: [member1],
            rates: { ...discountRates, "2top": 25 },
          })
        ).status,
        200,
      );
      assert.equal(
        (await api("/state", members[1].token)).data.memberDiscounts[0].rates[
          "2top"
        ],
        10,
      );
      assert.equal(recorded.gross, 300);
      assert.equal(recorded.net, 300);
      assert.ok(recorded.items.every((i) => !Object.hasOwn(i, "discount")));
      assert.equal((await q("SELECT credit FROM users WHERE id=?", [member1]))[0].credit, 0);
      assert.equal(
        (await api("/bills/" + billId, members[1].token, bill)).status,
        400,
        "cannot edit another member bill",
      );
      assert.equal(
        (
          await api("/bills/" + billId, members[0].token, {
            ...bill,
            items: [{ number: "32", type: "2top", amount: 200 }],
          })
        ).status,
        200,
      );
      assert.deepEqual(
        (await api("/state", members[0].token)).data.bills.find(
          (b) => b.id === billId,
        ).discountRates,
        discountRates,
        "editing retains original rates",
      );
      assert.equal((await q("SELECT credit FROM users WHERE id=?", [member1]))[0].credit, 0);
      assert.equal(
        (await api("/bills/" + billId, members[0].token, null, "DELETE"))
          .status,
        200,
      );
      assert.equal((await q("SELECT credit FROM users WHERE id=?", [member1]))[0].credit, 0);
      assert.equal(
        (await api("/bills/" + billId, members[0].token, null, "DELETE"))
          .status,
        400,
        "cannot cancel twice",
      );
      assert.equal(
        (
          await api("/bills", members[0].token, {
            draw_id: draw,
            items: [{ number: "99", type: "2top", amount: 10 }],
          })
        ).status,
        400,
        "blocked",
      );
      const simultaneous = await Promise.all(
        members.map((m) =>
          api("/bills", m.token, {
            draw_id: draw,
            items: [{ number: "55", type: "2top", amount: 600 }],
          }),
        ),
      );
      assert.deepEqual(
        simultaneous.map((r) => r.status).sort(),
        [200, 400],
        "team limit serializes simultaneous submissions",
      );
      const ms = (await api("/state", members[0].token)).data;
      assert.equal(ms.users.length, 1, "member cannot view team profiles");
      assert.ok(ms.bills.every((b) => b.member_id === member1));
      assert.equal(
        (
          await api("/users", members[0].token, {
            name: "Bad",
            phone: "0800000000",
          })
        ).status,
        403,
      );
      assert.equal((await api("/credit-requests", members[0].token, { amount: 250 })).status, 404);
      assert.equal((await api("/credit-requests/1", l, { approve: true }, "PATCH")).status, 404);
      assert.equal((await api("/state", l)).data.requests, undefined);
      assert.equal((await q("SELECT COUNT(*) AS n FROM credit_ledger WHERE member_id=?", [member1]))[0].n, 0);
      const savedSettings = (await api("/state", l)).data.settings.find((s) => s.lottery_id === lottery).config;
      assert.equal(savedSettings.discount, undefined);
      assert.equal(savedSettings.discounts, undefined);
      await api("/draw-settings/" + draw, l, {
        closeAt: new Date(Date.now() - 1000).toISOString(),
        blocked: [],
        half: [],
      });
      assert.equal(
        (await api("/bills", members[0].token, bill)).status,
        400,
        "closed draw refuses submit",
      );
      await api(
        "/draws/" + draw,
        a,
        { top3: "001", top2: "01", bottom2: "02" },
        "PATCH",
      );
      assert.equal(
        (await api("/state", members[0].token)).data.draws.find(
          (d) => d.id === draw,
        ).top3,
        null,
        "unpublished results are private",
      );
      await api(
        "/users/" + leader,
        a,
        { expires_at: new Date(Date.now() - 1000).toISOString(), active: true },
        "PATCH",
      );
      assert.equal(
        (await api("/me", members[0].token)).status,
        401,
        "leader expiry blocks entire team",
      );
      await api("/users/" + leader, a, { expires_at: extended, active: true }, "PATCH");
      assert.equal((await api(`/users/${member1}/reset-password`, members[0].token, {})).status, 403);
      assert.equal((await api(`/users/${member1}/reset-password`, a, {})).status, 400);
      assert.equal((await api(`/users/${leader}/reset-password`, l, {})).status, 400);
      await q("UPDATE users SET leader_id=NULL WHERE id=?", [member2]);
      assert.equal((await api(`/users/${member2}/password`, l)).status, 403);
      assert.equal((await api(`/users/${member2}/reset-password`, l, {})).status, 400);
      await q("UPDATE users SET leader_id=? WHERE id=?", [leader, member2]);
      const resetMember = await api(`/users/${member1}/reset-password`, l, {});
      assert.equal(resetMember.status, 200);
      assert.ok(resetMember.data.password.length >= 8);
      assert.equal((await api(`/users/${member1}/password`, l)).data.password, resetMember.data.password);
      assert.notEqual((await api("/login", null, {username:resetMember.data.username,password})).status, 200);
      const resetToken = await login(resetMember.data.username, resetMember.data.password);
      assert.equal((await api("/state", resetToken)).status, 403);
      assert.equal((await api("/password", resetToken, {current:resetMember.data.password,password})).status, 200);
      const resetState = (await api("/state", resetToken)).data;
      assert.equal(resetState.user.password, undefined);
      assert.equal(resetState.user.password_cipher, undefined);
      assert.equal((await api(`/users/${member1}/password`, l)).data.password, password);
      assert.ok(resetState.users.every((user) => user.password === undefined));
      assert.equal((await api(`/users/${member2}`, members[0].token, null, 'DELETE')).status, 403);
      await q("UPDATE users SET leader_id=NULL WHERE id=?", [member2]);
      assert.equal((await api(`/users/${member2}`, l, null, 'DELETE')).status, 400);
      await q("UPDATE users SET leader_id=? WHERE id=?", [leader, member2]);
      const beforeDeleteBills = (await api('/state', l)).data.bills;
      assert.equal((await api(`/users/${member2}`, l, null, 'DELETE')).status, 200);
      assert.equal((await api('/state', members[1].token)).status, 401);
      const afterDelete = (await api('/state', l)).data;
      assert.equal(afterDelete.users.find(u => u.id === member2).active, 0);
      assert.equal(afterDelete.bills.length, beforeDeleteBills.length, 'deletion retains bill history');
      const resetLeader = await api(`/users/${leader}/reset-password`, a, {});
      assert.equal(resetLeader.status, 200);
      const resetLeaderToken = await login(resetLeader.data.username, resetLeader.data.password);
      assert.equal((await api("/state", resetLeaderToken)).status, 403);
    } finally {
      const memberIds = [member1, member2].filter(Boolean);
      if (memberIds.length) {
        await q("DELETE FROM credit_ledger WHERE member_id IN (?)", [
          memberIds,
        ]);
        await q("DELETE FROM credit_requests WHERE member_id IN (?)", [
          memberIds,
        ]);
        await q("DELETE FROM bills WHERE member_id IN (?)", [memberIds]);
        await q("DELETE FROM notifications WHERE user_id IN (?)", [memberIds]);
        await q("DELETE FROM users WHERE id IN (?)", [memberIds]);
      }
      if (leader) {
        await q("DELETE FROM notifications WHERE user_id=?", [leader]);
        await q("DELETE FROM draw_settings WHERE leader_id=?", [leader]);
        await q("DELETE FROM settings WHERE leader_id=?", [leader]);
        await q("DELETE FROM users WHERE id=?", [leader]);
      }
      if (draw) await q("DELETE FROM draws WHERE id=?", [draw]);
      if (lottery) await q("DELETE FROM lotteries WHERE id=?", [lottery]);
      if (admin) await q("DELETE FROM users WHERE id=?", [admin]);
      await db.end();
    }
  },
);
if (!enabled) await db.end();
