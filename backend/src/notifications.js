import { db } from "./db.js";

// Store within the caller's transaction. Add external delivery providers only
// after commit; LINE OA is intentionally not connected in this version.
export async function notify(userId, message, connection = db) {
  await connection.query(
    "INSERT INTO notifications(user_id,message) VALUES (?,?)",
    [userId, message],
  );
}
