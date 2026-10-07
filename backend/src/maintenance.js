export const cleanupModes = {
  notifications: {
    title: "ล้างการแจ้งเตือน",
    tables: ["notifications"],
    phrase: "ล้างการแจ้งเตือน",
  },
  bills: {
    title: "ล้างโพยทั้งหมด",
    tables: ["bills"],
    phrase: "ล้างโพยทั้งหมด",
  },
  transactions: {
    title: "เริ่มยอดธุรกรรมใหม่",
    tables: ["bills", "credit_requests", "credit_ledger", "notifications"],
    phrase: "เริ่มยอดธุรกรรมใหม่",
  },
  launch: {
    title: "ล้างงวดและธุรกรรมก่อนขึ้น VPS",
    tables: [
      "bills",
      "draw_settings",
      "draws",
      "credit_requests",
      "credit_ledger",
      "notifications",
    ],
    phrase: "ล้างข้อมูลก่อนขึ้น VPS",
  },
  fresh: {
    title: "เริ่มระบบใหม่ เหลือ Admin และประเภทหวย",
    tables: [
      "bills",
      "draw_settings",
      "draws",
      "credit_requests",
      "credit_ledger",
      "notifications",
      "settings",
      "users",
    ],
    phrase: "เริ่มระบบใหม่ทั้งหมด",
  },
};
export async function cleanup(connection, mode, adminId) {
  const plan = Object.hasOwn(cleanupModes, mode) ? cleanupModes[mode] : null;
  if (!plan) throw Error("รูปแบบการล้างข้อมูลไม่ถูกต้อง");
  await connection.beginTransaction();
  try {
    await connection.query("SELECT id FROM users ORDER BY id FOR UPDATE");
    const deleted = {};
    for (const table of plan.tables) {
      const [result] = await connection.query(
        table === "users"
          ? "DELETE FROM users WHERE role='Member'"
          : "DELETE FROM " + table,
      );
      deleted[table] = result.affectedRows;
      if (table === "users") {
        const [leaders] = await connection.query(
          "DELETE FROM users WHERE role='Leader'",
        );
        deleted.users += leaders.affectedRows;
      }
    }
    await connection.commit();
    return deleted;
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}
