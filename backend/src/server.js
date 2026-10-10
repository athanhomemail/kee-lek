import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { db } from "./db.js";
import { cleanup, cleanupModes } from "./maintenance.js";
import { notify } from "./notifications.js";
import {
  defaults,
  price,
  winnings,
  billCurrency,
  currencyConfig,
  checkLimits,
} from "./rules.js";
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
  throw Error("Set JWT_SECRET to at least 32 characters");
const app = express(),
  http = createServer(app),
  io = new Server(http, {
    cors: { origin: process.env.FRONTEND_URL || "http://localhost:5173" },
  });
app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS || 0));
app.disable("x-powered-by");
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));
const route = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res)).catch(next);
const query = async (sql, params = [], conn = db) =>
  (await conn.query(sql, params))[0];
const bangkok = (value) =>
  new Date(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? value + ":00+07:00" : value,
  );
const clean = (u) => {
  const { password, credit, ...rest } = u;
  return rest;
};
const cleanConfig = ({ discount, discounts, ...config }) => config;
async function identity(token) {
  const { id } = jwt.verify(token, process.env.JWT_SECRET);
  const [u] = await query("SELECT * FROM users WHERE id=? AND active=1", [id]);
  if (!u) throw Error("กรุณาเข้าสู่ระบบใหม่");
  if (u.role !== "Admin") {
    const [l] =
      u.role === "Leader"
        ? [u]
        : await query("SELECT * FROM users WHERE id=?", [u.leader_id]);
    if (!l?.active || !l.expires_at || new Date(l.expires_at) <= new Date())
      throw Error("เวลาการใช้งานเครือข่ายหมดแล้ว");
  }
  return u;
}
io.use(async (s, next) => {
  try {
    s.user = await identity(s.handshake.auth.token);
    next();
  } catch (e) {
    next(e);
  }
});
io.on("connection", (s) => {
  s.join("user:" + s.user.id);
  if (s.user.role !== "Admin")
    s.join("team:" + (s.user.leader_id || s.user.id));
});
const changed = (leader) => io.to("team:" + leader).emit("refresh");
app.get(
  "/api/health",
  route(async (req, res) => {
    await db.query("SELECT 1");
    res.json({ ok: true });
  }),
);
const loginAttempts = new Map();
app.post(
  "/api/login",
  (req, res, next) => {
    const key = req.ip;
    let a = loginAttempts.get(key);
    if (!a || Date.now() - a.since > 900000) {
      a = { since: Date.now(), count: 0 };
      loginAttempts.set(key, a);
    }
    if (++a.count > 50)
      return res
        .status(429)
        .json({ error: "พยายามเข้าสู่ระบบหลายครั้ง กรุณารอ 15 นาที" });
    next();
  },
  route(async (req, res) => {
    const [u] = await query("SELECT * FROM users WHERE username=?", [
      req.body.username,
    ]);
    if (!u || !(await bcrypt.compare(req.body.password || "", u.password)))
      return res
        .status(401)
        .json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
    const token = jwt.sign({ id: u.id }, process.env.JWT_SECRET, {
      expiresIn: "12h",
    });
    await identity(token);
    res.json({ token, user: clean(u) });
  }),
);
app.use("/api", async (req, res, next) => {
  try {
    req.user = await identity(
      req.headers.authorization?.replace("Bearer ", ""),
    );
    if (req.user.must_change && !["/password", "/me"].includes(req.path))
      return res.status(403).json({ error: "กรุณาเปลี่ยนรหัสผ่านก่อนใช้งาน" });
    next();
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
});
const role = (r) => (req, res, next) =>
  r.includes(req.user.role)
    ? next()
    : res.status(403).json({ error: "ไม่มีสิทธิ์ใช้งาน" });
app.get("/api/me", (req, res) => res.json(clean(req.user)));
app.post(
  "/api/password",
  route(async (req, res) => {
    if (!(await bcrypt.compare(req.body.current || "", req.user.password)))
      throw Error("รหัสผ่านเดิมไม่ถูกต้อง");
    if ((req.body.password || "").length < 8)
      throw Error("รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร");
    await query("UPDATE users SET password=?,must_change=0 WHERE id=?", [
      await bcrypt.hash(req.body.password, 12),
      req.user.id,
    ]);
    res.json({ ok: true });
  }),
);
app.get(
  "/api/state",
  route(async (req, res) => {
    const u = req.user,
      leader = u.leader_id || u.id;
    const lotteries = await query("SELECT * FROM lotteries");
    const draws = await query(
      "SELECT d.*,l.name,l.kind,l.flag,l.enabled FROM draws d JOIN lotteries l ON l.id=d.lottery_id ORDER BY draw_date DESC",
    );
    for (const d of draws)
      if (u.role !== "Admin" && new Date(d.result_at) > new Date()) {
        d.top3 = null;
        d.top2 = null;
        d.bottom2 = null;
      }
    const users = await query(
      u.role === "Admin"
        ? "SELECT * FROM users WHERE role='Leader'"
        : u.role === "Member"
          ? "SELECT * FROM users WHERE id=?"
          : "SELECT * FROM users WHERE leader_id=?",
      [...(u.role === "Admin" ? [] : [u.role === "Member" ? u.id : leader])],
    );
    const bills = await query(
      u.role === "Admin"
        ? "SELECT b.*,u.name AS member_name FROM bills b JOIN users u ON u.id=b.member_id"
        : u.role === "Leader"
          ? "SELECT b.*,u.name AS member_name FROM bills b JOIN users u ON u.id=b.member_id WHERE b.leader_id=?"
          : "SELECT b.*,u.name AS member_name FROM bills b JOIN users u ON u.id=b.member_id WHERE b.member_id=?",
      u.role === "Admin" ? [] : [u.id],
    );
    const settings = await query("SELECT * FROM settings WHERE leader_id=?", [
      leader,
    ]);
    const drawSettings = await query(
      "SELECT * FROM draw_settings WHERE leader_id=?",
      [leader],
    );
    const notifications = await query(
      "SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 30",
      [u.id],
    );
    const teamBills =
      u.role === "Admin"
        ? []
        : await query(
            "SELECT draw_id,items FROM bills WHERE leader_id=? AND status='active'",
            [leader],
          );
    const accessOwner =
      u.role === "Admin"
        ? null
        : u.role === "Leader"
          ? u
          : (
              await query("SELECT expires_at FROM users WHERE id=?", [
                u.leader_id,
              ])
            )[0];
    res.json({
      user: clean(u),
      accessExpiresAt: accessOwner?.expires_at || null,
      lotteries,
      draws,
      users: users.map(clean),
      bills: bills.map((b) => ({
        ...b,
        currency: billCurrency(b),
        items: b.items.map(({ discount, ...item }) => item),
        win: winnings(b, draws.find((d) => d.id === b.draw_id) || {}),
      })),
      settings: settings.map((s) => ({ ...s, config: cleanConfig(s.config) })),
      drawSettings: drawSettings.map((s) => ({
        ...s,
        config: cleanConfig(s.config),
      })),
      notifications,
      usage: teamBills.map((b) => ({
        draw_id: b.draw_id,
        currency: billCurrency(b),
        items: b.items.map((i) => ({
          number: i.number,
          type: i.type,
          amount: i.amount,
        })),
      })),
      defaults,
    });
  }),
);
app.post(
  "/api/users",
  role(["Admin", "Leader"]),
  route(async (req, res) => {
    const u = req.user;
    const { name, phone, expires_at } = req.body;
    if (!name?.trim() || !/^\+?[0-9 -]{8,20}$/.test(phone || ""))
      throw Error("กรุณากรอกชื่อและเบอร์โทร");
    if (
      u.role === "Admin" &&
      (!expires_at || !Number.isFinite(Date.parse(expires_at)))
    )
      throw Error("ต้องกำหนดวันหมดอายุ");
    const password = randomBytes(9).toString("base64url"),
      username =
        (u.role === "Admin" ? "leader" : "ld" + u.id + "mem") +
        randomBytes(4).toString("hex");
    await query(
      "INSERT INTO users(username,password,name,phone,role,leader_id,expires_at) VALUES (?,?,?,?,?,?,?)",
      [
        username,
        await bcrypt.hash(password, 12),
        name,
        phone,
        u.role === "Admin" ? "Leader" : "Member",
        u.role === "Admin" ? null : u.id,
        u.role === "Admin" ? bangkok(expires_at) : null,
      ],
    );
    res.json({ username, password });
    changed(u.id);
  }),
);
app.patch(
  "/api/users/:id",
  role(["Admin"]),
  route(async (req, res) => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [target] = await query(
        "SELECT * FROM users WHERE id=? FOR UPDATE",
        [req.params.id],
        conn,
      );
      if (
        !target ||
        (req.user.role === "Admin"
          ? target.role !== "Leader"
          : target.leader_id !== req.user.id)
      )
        throw Error("ไม่มีสิทธิ์");
      if (req.user.role === "Admin") {
        if (!Number.isFinite(Date.parse(req.body.expires_at)))
          throw Error("วันหมดอายุไม่ถูกต้อง");
        await query(
          "UPDATE users SET expires_at=?,active=? WHERE id=?",
          [bangkok(req.body.expires_at), req.body.active ? 1 : 0, target.id],
          conn,
        );
      }
      await conn.commit();
      io.to("user:" + target.id).emit("refresh");
      if (req.user.role === "Admin") changed(target.id);
      changed(req.user.id);
      res.json({ ok: true });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }),
);
app.post(
  "/api/lotteries",
  role(["Admin"]),
  route(async (req, res) => {
    if (!req.body.name || !["หวยไทย", "หวยนอก"].includes(req.body.kind))
      throw Error("ข้อมูลไม่ถูกต้อง");
    await query(
      "INSERT INTO lotteries(name,kind,flag,enabled) VALUES (?,?,?,1)",
      [req.body.name, req.body.kind, req.body.flag || "🎟️"],
    );
    res.json({ ok: true });
  }),
);
app.patch(
  "/api/lotteries/:id",
  role(["Admin"]),
  route(async (req, res) => {
    await query("UPDATE lotteries SET enabled=? WHERE id=?", [
      req.body.enabled ? 1 : 0,
      req.params.id,
    ]);
    io.emit("refresh");
    res.json({ ok: true });
  }),
);
app.post(
  "/api/draws",
  role(["Admin"]),
  route(async (req, res) => {
    const b = req.body;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(b.draw_date) ||
      !Number.isFinite(Date.parse(b.result_at))
    )
      throw Error("วันเวลาไม่ถูกต้อง");
    await query(
      "INSERT INTO draws(lottery_id,draw_date,result_at) VALUES (?,?,?)",
      [b.lottery_id, b.draw_date, bangkok(b.result_at)],
    );
    io.emit("refresh");
    res.json({ ok: true });
  }),
);
app.patch(
  "/api/draws/:id",
  role(["Admin"]),
  route(async (req, res) => {
    const b = req.body;
    if (
      !/^\d{3}$/.test(b.top3) ||
      !/^\d{2}$/.test(b.top2) ||
      !/^\d{2}$/.test(b.bottom2)
    )
      throw Error("ผลต้องครบ 3 ตัวบน 2 ตัวบน 2 ตัวล่าง");
    await query("UPDATE draws SET top3=?,top2=?,bottom2=? WHERE id=?", [
      b.top3,
      b.top2,
      b.bottom2,
      req.params.id,
    ]);
    io.emit("refresh");
    res.json({ ok: true });
  }),
);
app.post(
  "/api/settings/:lottery",
  role(["Leader"]),
  route(async (req, res) => {
    const { discount, discounts, ...settings } = req.body;
    const c = { ...defaults, ...settings };
    if (
      !Number.isFinite(Date.parse(c.closeAt)) ||
      !(c.limit > 0) ||
      !Array.isArray(c.blocked) ||
      !Array.isArray(c.half) ||
      Object.keys(defaults.rates).some(
        (k) => !Number.isFinite(Number(c.rates?.[k])) || Number(c.rates[k]) < 0,
      ) ||
      (c.lak &&
        (Object.keys(defaults.rates).some(
          (k) => !Number.isFinite(c.lak.rates?.[k]) || c.lak.rates[k] < 0,
        ) ||
          Object.keys(defaults.rates).some(
            (k) => !Number.isFinite(c.lak.limits?.[k]) || c.lak.limits[k] <= 0,
          ) ||
          !Number.isFinite(c.lak.limit) ||
          c.lak.limit <= 0)) ||
      Object.values(c.limits || {}).some(
        (n) => !Number.isFinite(Number(n)) || Number(n) <= 0,
      )
    )
      throw Error("การตั้งค่าไม่ถูกต้อง");
    await query(
      "INSERT INTO settings VALUES (?,?,?) ON DUPLICATE KEY UPDATE config=VALUES(config)",
      [req.user.id, req.params.lottery, JSON.stringify(c)],
    );
    changed(req.user.id);
    res.json({ ok: true });
  }),
);
app.put(
  "/api/lotteries/:id",
  role(["Admin"]),
  route(async (req, res) => {
    const b = req.body;
    if (!b.name?.trim() || !["หวยไทย", "หวยนอก"].includes(b.kind))
      throw Error("ข้อมูลหวยไม่ถูกต้อง");
    await query("UPDATE lotteries SET name=?,kind=?,flag=? WHERE id=?", [
      b.name,
      b.kind,
      b.flag || "🎟️",
      req.params.id,
    ]);
    io.emit("refresh");
    res.json({ ok: true });
  }),
);
app.delete(
  "/api/lotteries/:id",
  role(["Admin"]),
  route(async (req, res) => {
    const [d] = await query(
      "SELECT COUNT(*) AS n FROM draws WHERE lottery_id=?",
      [req.params.id],
    );
    if (d.n) throw Error("หวยนี้มีงวดแล้ว ใช้ปิดใช้งานเพื่อรักษาประวัติ");
    await query("DELETE FROM settings WHERE lottery_id=?", [req.params.id]);
    await query("DELETE FROM lotteries WHERE id=?", [req.params.id]);
    io.emit("refresh");
    res.json({ ok: true });
  }),
);
app.put(
  "/api/draws/:id",
  role(["Admin"]),
  route(async (req, res) => {
    const b = req.body;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(b.draw_date) ||
      !Number.isFinite(Date.parse(b.result_at))
    )
      throw Error("วันเวลาไม่ถูกต้อง");
    const [bills] = await query(
      "SELECT COUNT(*) AS n FROM bills WHERE draw_id=?",
      [req.params.id],
    );
    if (bills.n) throw Error("งวดมีโพยแล้ว ไม่สามารถเลื่อนวันเวลาได้");
    await query("UPDATE draws SET draw_date=?,result_at=? WHERE id=?", [
      b.draw_date,
      bangkok(b.result_at),
      req.params.id,
    ]);
    io.emit("refresh");
    res.json({ ok: true });
  }),
);
app.delete(
  "/api/draws/:id",
  role(["Admin"]),
  route(async (req, res) => {
    const [b] = await query("SELECT COUNT(*) AS n FROM bills WHERE draw_id=?", [
      req.params.id,
    ]);
    if (b.n) throw Error("งวดนี้มีโพยแล้ว ไม่สามารถลบประวัติได้");
    const c = await db.getConnection();
    try {
      await c.beginTransaction();
      await query(
        "DELETE FROM draw_settings WHERE draw_id=?",
        [req.params.id],
        c,
      );
      await query("DELETE FROM draws WHERE id=?", [req.params.id], c);
      await c.commit();
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
    io.emit("refresh");
    res.json({ ok: true });
  }),
);
app.post(
  "/api/draw-settings/:draw",
  role(["Leader"]),
  route(async (req, res) => {
    const c = { ...req.body, closeAt: bangkok(req.body.closeAt).toISOString() };
    if (
      !Number.isFinite(Date.parse(c.closeAt)) ||
      !Array.isArray(c.blocked) ||
      !Array.isArray(c.half) ||
      [...c.blocked, ...c.half].some((n) => !/^[0-9]{1,3}$/.test(n))
    )
      throw Error("ข้อมูลกฎงวดไม่ถูกต้อง");
    const [d] = await query("SELECT * FROM draws WHERE id=?", [
      req.params.draw,
    ]);
    if (!d || new Date(c.closeAt) > new Date(d.result_at))
      throw Error("เวลาปิดรับต้องไม่เกินเวลาออกผล");
    await query(
      "INSERT INTO draw_settings VALUES (?,?,?) ON DUPLICATE KEY UPDATE config=VALUES(config)",
      [req.user.id, req.params.draw, JSON.stringify(c)],
    );
    changed(req.user.id);
    res.json({ ok: true });
  }),
);
app.post(
  ["/api/bills", "/api/bills/:id"],
  role(["Member"]),
  route(async (req, res) => {
    const c = await db.getConnection();
    try {
      await c.beginTransaction(); // Serializes team submissions to enforce per-number limits.
      const [leader] = await query(
        "SELECT * FROM users WHERE id=? FOR UPDATE",
        [req.user.leader_id],
        c,
      );
      if (!leader.active || new Date(leader.expires_at) <= new Date())
        throw Error("เครือข่ายหมดอายุ");
      const [member] = await query(
        "SELECT * FROM users WHERE id=? FOR UPDATE",
        [req.user.id],
        c,
      );
      let previous = null;
      if (req.params.id) {
        [previous] = await query(
          "SELECT * FROM bills WHERE id=? AND member_id=? AND status='active' FOR UPDATE",
          [req.params.id, member.id],
          c,
        );
        if (!previous || previous.draw_id !== Number(req.body.draw_id))
          throw Error("ไม่พบโพยที่แก้ไขได้");
      }
      const [draw] = await query(
        "SELECT d.*,l.enabled FROM draws d JOIN lotteries l ON l.id=d.lottery_id WHERE d.id=?",
        [req.body.draw_id],
        c,
      );
      if (!draw?.enabled) throw Error("หวยไม่เปิดรับ");
      const [setting] = await query(
        "SELECT config FROM settings WHERE leader_id=? AND lottery_id=?",
        [leader.id, draw.lottery_id],
        c,
      );
      const [drawSetting] = await query(
        "SELECT config FROM draw_settings WHERE leader_id=? AND draw_id=?",
        [leader.id, draw.id],
        c,
      );
      if (!setting) throw Error("หัวหน้ายังไม่ได้กำหนดอัตราจ่าย");
      const currency = req.body.currency || "THB";
      if (previous && billCurrency(previous) !== currency)
        throw Error("ไม่สามารถเปลี่ยนสกุลเงินของบิลเดิม");
      const merged = { ...setting.config, ...drawSetting?.config };
      const config = currencyConfig(merged, currency);
      if (
        !drawSetting?.config?.closeAt ||
        Date.now() >=
          Math.min(
            new Date(config.closeAt).getTime(),
            new Date(draw.result_at).getTime(),
          )
      )
        throw Error("ปิดรับแล้วหรือยังไม่ได้ตั้งค่าปิดรับ");
      const bill = price(req.body.items, merged, currency);
      const existing = await query(
        "SELECT items FROM bills WHERE leader_id=? AND draw_id=? AND status='active' AND id<>?",
        [leader.id, draw.id, previous?.id || 0],
        c,
      );
      checkLimits(existing, bill.items, config, currency);
      let r;
      if (previous) {
        await query(
          "UPDATE bills SET items=?,gross=?,net=?,note=? WHERE id=?",
          [
            JSON.stringify(bill.items),
            bill.gross,
            bill.net,
            String(req.body.note || "").slice(0, 500),
            previous.id,
          ],
          c,
        );
        r = { insertId: previous.id };
      } else
        r = await query(
          "INSERT INTO bills(member_id,leader_id,draw_id,items,gross,net,note) VALUES (?,?,?,?,?,?,?)",
          [
            member.id,
            leader.id,
            draw.id,
            JSON.stringify(bill.items),
            bill.gross,
            bill.net,
            String(req.body.note || "").slice(0, 500),
          ],
          c,
        );
      await notify(
        leader.id,
        member.name +
          " ส่งโพย #" +
          r.insertId +
          " ยอด " +
          bill.gross +
          (currency === "LAK" ? " K กีบ" : " บาท"),
        c,
      );
      await c.commit();
      changed(leader.id);
      res.json({ id: r.insertId });
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }),
);
app.delete(
  "/api/bills/:id",
  role(["Member"]),
  route(async (req, res) => {
    const c = await db.getConnection();
    try {
      await c.beginTransaction();
      await query(
        "SELECT id FROM users WHERE id=? FOR UPDATE",
        [req.user.leader_id],
        c,
      );
      const [b] = await query(
        "SELECT b.*,d.lottery_id,d.result_at FROM bills b JOIN draws d ON d.id=b.draw_id WHERE b.id=? AND b.member_id=? FOR UPDATE",
        [req.params.id, req.user.id],
        c,
      );
      if (!b || b.status !== "active") throw Error("ไม่พบโพยที่ยกเลิกได้");
      const [s] = await query(
        "SELECT config FROM draw_settings WHERE leader_id=? AND draw_id=?",
        [b.leader_id, b.draw_id],
        c,
      );
      if (
        !s ||
        Date.now() >=
          Math.min(
            new Date(s.config.closeAt).getTime(),
            bangkok(b.result_at).getTime(),
          )
      )
        throw Error("ปิดรับแล้ว");
      await query("UPDATE bills SET status='cancelled' WHERE id=?", [b.id], c);
      await c.commit();
      changed(b.leader_id);
      res.json({ ok: true });
    } catch (e) {
      await c.rollback();
      throw e;
    } finally {
      c.release();
    }
  }),
);
const maintenanceTables = [
  "users",
  "lotteries",
  "draws",
  "settings",
  "draw_settings",
  "bills",
  "credit_requests",
  "credit_ledger",
  "notifications",
];
app.get(
  "/api/maintenance",
  role(["Admin"]),
  route(async (req, res) => {
    const counts = {};
    for (const table of maintenanceTables) {
      const [row] = await query(
        "SELECT COUNT(*) AS n FROM " +
          table +
          (table === "users" ? " WHERE role!='Admin'" : ""),
      );
      counts[table] = row.n;
    }
    res.json({ counts });
  }),
);
app.get(
  "/api/maintenance/backup",
  role(["Admin"]),
  route(async (req, res) => {
    const c = await db.getConnection();
    try {
      await c.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
      await c.query("START TRANSACTION WITH CONSISTENT SNAPSHOT");
      const tables = {};
      for (const table of maintenanceTables)
        tables[table] = await query("SELECT * FROM " + table, [], c);
      await c.commit();
      res.json({
        format: "keelek-backup-v1",
        createdAt: new Date().toISOString(),
        tables,
      });
    } catch (error) {
      await c.rollback();
      throw error;
    } finally {
      c.release();
    }
  }),
);
app.post(
  "/api/maintenance/clear",
  role(["Admin"]),
  route(async (req, res) => {
    const plan = Object.hasOwn(cleanupModes, req.body.mode)
      ? cleanupModes[req.body.mode]
      : null;
    if (
      !plan ||
      req.body.confirmation !== plan.phrase ||
      req.body.backupConfirmed !== true
    )
      throw Error("กรุณาสำรองข้อมูลและพิมพ์คำยืนยันให้ถูกต้อง");
    if (!(await bcrypt.compare(req.body.password || "", req.user.password)))
      throw Error("รหัสผ่าน Admin ไม่ถูกต้อง");
    const c = await db.getConnection();
    try {
      const deleted = await cleanup(c, req.body.mode, req.user.id);
      io.emit("refresh");
      res.json({ deleted });
    } finally {
      c.release();
    }
  }),
);
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(400).json({
    error: err.code
      ? "ไม่สามารถบันทึกข้อมูลได้ กรุณาตรวจสอบข้อมูล"
      : err.message,
  });
});
setInterval(async () => {
  for (const socket of io.sockets.sockets.values())
    try {
      await identity(socket.handshake.auth.token);
    } catch {
      socket.emit("expired");
      socket.disconnect(true);
    }
}, 60000).unref();
http.listen(process.env.PORT || 4000, process.env.API_HOST || "127.0.0.1", () =>
  console.log("Kee-Lek API ready"),
);
