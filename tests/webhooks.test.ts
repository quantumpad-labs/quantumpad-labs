import test from "node:test";
import assert from "node:assert/strict";
import { publicAddress, signature, webhookUrl } from "../src/lib/webhooks";
test("webhooks reject private, loopback, metadata and reserved networks", () => {
  for (const a of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "172.16.1.1",
    "192.168.1.1",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "::ffff:127.0.0.1",
    "198.18.0.1",
    "224.0.0.1",
  ])
    assert.equal(publicAddress(a), false, a);
  assert.equal(publicAddress("8.8.8.8"), true);
});
test("webhook URL validation prevents alternate protocols, credentials and ports", () => {
  for (const u of [
    "http://example.com",
    "https://user:password@example.com",
    "https://example.com:8443",
    "https://127.0.0.1",
    "https://localhost",
  ])
    assert.throws(() => webhookUrl(u));
  assert.equal(webhookUrl("https://example.com/events").pathname, "/events");
});
test("webhook signature binds the timestamp and exact serialized body", () => {
  const sig = signature("secret", "123", '{"a":1}');
  assert.equal(sig, signature("secret", "123", '{"a":1}'));
  assert.notEqual(sig, signature("secret", "124", '{"a":1}'));
  assert.notEqual(sig, signature("secret", "123", '{"a":2}'));
});
