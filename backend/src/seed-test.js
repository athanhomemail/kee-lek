import { db } from "./db.js";
import bcrypt from "bcryptjs";
import { defaults } from "./rules.js";
if (process.env.NODE_ENV === "production")
  throw Error("Test accounts are for local development only");
const query = async (sql, args = []) => (await db.query(sql, args))[0];
const hash = await bcrypt.hash("test1234", 12);
for (const [username, name, role] of [
  ["testadmin", "ผู้ดูแลทดสอบ", "Admin"],
  ["testleader", "หัวหน้าทดสอบ", "Leader"],
  ["testmember", "สมาชิกทดสอบ", "Member"],
]) {
  const [leader] =
    role === "Member"
      ? await query("SELECT id FROM users WHERE username='testleader'")
      : [];
  await query(
    "INSERT IGNORE INTO users(username,password,name,phone,role,leader_id,expires_at,credit,must_change) VALUES (?,?,?,?,?,?,?,?,0)",
    [
      username,
      hash,
      name,
      "0800000000",
      role,
      leader?.id || null,
      role === "Leader" ? new Date(Date.now() + 365 * 86400000) : null,
      role === "Member" ? 10000 : 0,
    ],
  );
  const [user] = await query("SELECT role FROM users WHERE username=?", [
    username,
  ]);
  if (user.role !== role)
    throw Error("Existing username has a different role: " + username);
}
const [leader] = await query(
  "SELECT id FROM users WHERE username='testleader'",
);
for (const lottery of await query("SELECT id FROM lotteries WHERE enabled=1")) {
  await query("INSERT IGNORE INTO settings VALUES (?,?,?)", [
    leader.id,
    lottery.id,
    JSON.stringify({
      ...defaults,
      discount: 10,
      closeAt: new Date(Date.now() + 86400000).toISOString(),
    }),
  ]);
}
console.log(
  "Test accounts ready: testadmin, testleader, testmember / password: test1234. Existing accounts and balances are preserved.",
);
await db.end();
