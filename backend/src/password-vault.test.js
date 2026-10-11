import test from "node:test";
import assert from "node:assert/strict";
import { createPasswordVault } from "./password-vault.js";

test("password vault encrypts reversibly with authenticated encryption and random nonces", () => {
  const vault = createPasswordVault("a".repeat(48));
  const password = "ภาษาไทย-Latin123!";
  const first = vault.encrypt(password),
    second = vault.encrypt(password);
  assert.notEqual(first, second);
  assert.ok(!first.includes(password));
  assert.equal(vault.decrypt(first), password);
  assert.equal(vault.decrypt(second), password);
  assert.throws(() => createPasswordVault("b".repeat(48)).decrypt(first));
  const parts = first.split(":");
  parts[3] = Buffer.from("tampered").toString("base64");
  assert.throws(() => vault.decrypt(parts.join(":")));
  assert.throws(() => vault.decrypt("invalid"));
  assert.throws(() => createPasswordVault("short"));
});
