import { db } from "./db.js";
import bcrypt from "bcryptjs";
if (
  process.env.NODE_ENV === "production" &&
  (!process.env.ADMIN_INITIAL_PASSWORD ||
    process.env.ADMIN_INITIAL_PASSWORD.length < 16 ||
    process.env.ADMIN_INITIAL_PASSWORD === "password")
)
  throw Error(
    "Production requires a random ADMIN_INITIAL_PASSWORD of at least 16 characters",
  );
const hash = await bcrypt.hash(
  process.env.ADMIN_INITIAL_PASSWORD || "password",
  12,
);
for (const [username, name] of [
  ["admintor", "ต่อ"],
  ["adminmike", "ไมค์"],
])
  await db.query(
    "INSERT IGNORE INTO users(username,password,name,role,must_change) VALUES (?,?,?,'Admin',TRUE)",
    [username, hash, name],
  );
console.log("Admin accounts seeded; change initial passwords on first login.");
await db.end();
