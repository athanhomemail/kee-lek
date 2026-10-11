import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

// Separate key domain from JWT signing; an explicit vault key can be used to
// keep decrypting existing passwords when the JWT signing secret is rotated.
export function createPasswordVault(secret) {
  if (typeof secret !== "string" || secret.length < 32)
    throw Error(
      "Password encryption requires a secret of at least 32 characters",
    );
  const key = createHash("sha256")
    .update("keelek:password-vault:v1\0" + secret)
    .digest();
  return {
    encrypt(password) {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const encrypted = Buffer.concat([
        cipher.update(password, "utf8"),
        cipher.final(),
      ]);
      return [
        "v1",
        iv.toString("base64"),
        cipher.getAuthTag().toString("base64"),
        encrypted.toString("base64"),
      ].join(":");
    },
    decrypt(record) {
      const [version, iv, tag, encrypted, extra] = String(record).split(":");
      if (version !== "v1" || !iv || !tag || !encrypted || extra)
        throw Error("Invalid encrypted password");
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(iv, "base64"),
      );
      decipher.setAuthTag(Buffer.from(tag, "base64"));
      return Buffer.concat([
        decipher.update(Buffer.from(encrypted, "base64")),
        decipher.final(),
      ]).toString("utf8");
    },
  };
}

export async function ensurePasswordVaultSchema(database) {
  const [columns] = await database.query(
    "SHOW COLUMNS FROM users LIKE 'password_cipher'",
  );
  if (!columns.length) {
    try {
      await database.query(
        "ALTER TABLE users ADD COLUMN password_cipher TEXT NULL",
      );
    } catch (error) {
      if (error.code !== "ER_DUP_FIELDNAME") throw error;
    }
  }
}
