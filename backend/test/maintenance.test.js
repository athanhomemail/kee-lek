import test from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/db.js";
import { cleanup } from "../src/maintenance.js";
const enabled = process.env.RUN_INTEGRATION === "1";
test(
  "maintenance uses an isolated temporary schema: refunds, resets and rollback",
  { skip: !enabled },
  async () => {
    const c = await db.getConnection();
    const definitions = {
      users: "id INT PRIMARY KEY,role VARCHAR(20),credit DECIMAL(14,2)",
      bills:
        "id INT PRIMARY KEY,member_id INT,net DECIMAL(14,2),status VARCHAR(20)",
      credit_ledger:
        "member_id INT,actor_id INT,amount DECIMAL(14,2),reason VARCHAR(150)",
      credit_requests: "id INT",
      notifications: "id INT",
      draws: "id INT",
      draw_settings: "id INT",
      settings: "id INT",
    };
    const created = [];
    try {
      for (const [table, columns] of Object.entries(definitions)) {
        await c.query(
          "CREATE TEMPORARY TABLE " +
            table +
            " (" +
            columns +
            ") ENGINE=InnoDB",
        );
        created.push(table);
      }
      const seed = async () => {
        for (const table of created) await c.query("DELETE FROM " + table);
        await c.query(
          "INSERT INTO users VALUES (1,'Admin',0),(2,'Leader',0),(3,'Member',500)",
        );
        await c.query(
          "INSERT INTO bills VALUES (1,3,100,'active'),(2,3,30,'cancelled')",
        );
        await c.query("INSERT INTO credit_ledger VALUES (3,1,500,'credit')");
        for (const table of [
          "credit_requests",
          "notifications",
          "draws",
          "draw_settings",
          "settings",
        ])
          await c.query("INSERT INTO " + table + " VALUES (1)");
      };
      const count = async (table) =>
        (await c.query("SELECT COUNT(*) AS n FROM " + table))[0][0].n;
      await seed();
      await cleanup(c, "bills", 1);
      assert.equal(await count("bills"), 0);
      assert.equal(
        (await c.query("SELECT credit FROM users WHERE id=3"))[0][0].credit,
        600,
      );
      assert.equal(await count("credit_ledger"), 2);
      assert.equal(await count("draws"), 1);
      await seed();
      await cleanup(c, "notifications", 1);
      assert.equal(await count("notifications"), 0);
      assert.equal(await count("bills"), 2);
      await seed();
      await cleanup(c, "transactions", 1);
      assert.equal(await count("bills"), 0);
      assert.equal(await count("draws"), 1);
      assert.equal(
        (await c.query("SELECT credit FROM users WHERE id=3"))[0][0].credit,
        0,
      );
      await seed();
      await cleanup(c, "launch", 1);
      assert.equal(await count("draws"), 0);
      assert.equal(await count("draw_settings"), 0);
      assert.equal(await count("settings"), 1);
      assert.equal(await count("users"), 3);
      await seed();
      await cleanup(c, "fresh", 1);
      assert.equal(await count("users"), 1);
      assert.equal(
        (await c.query("SELECT role FROM users"))[0][0].role,
        "Admin",
      );
      assert.equal(await count("settings"), 0);
      await seed();
      const fault = {
        beginTransaction: () => c.beginTransaction(),
        commit: () => c.commit(),
        rollback: () => c.rollback(),
        query: (sql, args) =>
          sql === "DELETE FROM draws"
            ? Promise.reject(Error("simulated failure"))
            : c.query(sql, args),
      };
      await assert.rejects(cleanup(fault, "launch", 1), /simulated failure/);
      assert.equal(await count("bills"), 2);
      assert.equal(await count("draw_settings"), 1);
    } finally {
      for (const table of created.reverse())
        await c.query("DROP TEMPORARY TABLE IF EXISTS " + table);
      c.release();
    await db.end();
    }
  },
);
