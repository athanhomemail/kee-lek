import "dotenv/config";
import mysql from "mysql2/promise";
export const db = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3308),
  user: process.env.DB_USER || "keelek",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "keeled",
  timezone: "+07:00",
  dateStrings: ["DATE"],
  decimalNumbers: true,
  connectionLimit: 10,
});
