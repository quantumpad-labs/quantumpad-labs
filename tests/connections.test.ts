import test from "node:test";
import assert from "node:assert/strict";
import { sealCredential, openCredential } from "../src/lib/connections";

test("provider credentials are encrypted and bound to wallet, provider and purpose", () => {
  process.env.WEBHOOK_ENCRYPTION_KEY = "ab".repeat(32);
  const encrypted = sealCredential("wallet-a", "vast", "test-key-not-live");
  assert.ok(!encrypted.includes("test-key-not-live"));
  assert.equal(
    openCredential(encrypted, "wallet-a", "vast"),
    "test-key-not-live",
  );
  assert.throws(() => openCredential(encrypted, "wallet-b", "vast"));
  assert.throws(() => openCredential(encrypted, "wallet-a", "runpod"));
  const parts = encrypted.split(".");
  parts[2] = Buffer.from("tampered").toString("base64");
  assert.throws(() => openCredential(parts.join("."), "wallet-a", "vast"));
});
