import test from "node:test";
import assert from "node:assert/strict";
import type { EIP1193Provider } from "viem";
import { chain } from "../src/lib/chain";
import { ensureWalletChain, transactionWallet, walletAccountChanged } from "../src/lib/wallet-session";

const owner = "0x1111111111111111111111111111111111111111";
const other = "0x2222222222222222222222222222222222222222";
function mockWallet(options: { chainId?: number; account?: string; switchError?: number; ignoresSwitch?: boolean } = {}) {
  let id = options.chainId ?? chain.id, added = false;
  const calls: string[] = [];
  const provider = { request: async ({ method }: { method: string }) => {
    calls.push(method);
    if (method === "eth_chainId") return `0x${id.toString(16)}`;
    if (method === "eth_accounts") return [options.account ?? owner];
    if (method === "wallet_switchEthereumChain") {
      if (options.switchError && !added) throw { code: options.switchError, message: "Switch failed" };
      if (!options.ignoresSwitch) id = chain.id;
      return null;
    }
    if (method === "wallet_addEthereumChain") { added = true; return null; }
    throw new Error(`Unexpected wallet method: ${method}`);
  } } as EIP1193Provider;
  return { provider, calls };
}
test("restored session reconnects and completes wallet preparation without a forced failure", async () => {
  const { provider, calls } = mockWallet();
  let connections = 0;
  const result = await transactionWallet(owner, null, async () => { connections++; return { owner, provider }; });
  assert.equal(result.account, owner);
  assert.equal(connections, 1);
  assert.deepEqual(calls, ["eth_chainId", "eth_accounts"]);
});
test("selected provider is used without reconnecting or requesting a transaction", async () => {
  const { provider, calls } = mockWallet();
  await transactionWallet(owner, provider, async () => { throw Error("Must not reconnect"); });
  assert.deepEqual(calls, ["eth_chainId", "eth_accounts"]);
});
test("a reattached wallet dispatches exactly one reviewed transaction through the selected provider", async () => {
  const base = mockWallet();
  const sent: any[] = [];
  const provider = { request: async (request: any) => {
    if (request.method === "eth_sendTransaction") { sent.push(request.params[0]); return `0x${"12".repeat(32)}`; }
    return base.provider.request(request);
  } } as EIP1193Provider;
  const { client, account } = await transactionWallet(owner, null, async () => ({ owner, provider }));
  await client.sendTransaction({ account, to: other, value: 1n, gas: 21000n });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].from.toLowerCase(), owner);
  assert.equal(sent[0].to.toLowerCase(), other);
  assert.equal(sent[0].value, "0x1");
});
test("wrong network switches back and retains the reviewed account", async () => {
  const { provider, calls } = mockWallet({ chainId: 1 });
  await transactionWallet(owner, provider, async () => null);
  assert.ok(calls.includes("wallet_switchEthereumChain"));
  assert.ok(!calls.includes("wallet_addEthereumChain"));
});
test("unknown network adds the configured chain then switches", async () => {
  const { provider, calls } = mockWallet({ chainId: 1, switchError: 4902 });
  await ensureWalletChain(provider);
  assert.equal(calls.filter(c => c === "wallet_addEthereumChain").length, 1);
  assert.equal(calls.filter(c => c === "wallet_switchEthereumChain").length, 2);
});
test("rejected or unsupported network switches never trigger an add-chain prompt", async () => {
  for (const code of [4001, 4200]) {
    const { provider, calls } = mockWallet({ chainId: 1, switchError: code });
    await assert.rejects(() => ensureWalletChain(provider));
    assert.ok(!calls.includes("wallet_addEthereumChain"));
  }
});
test("wallet that ignores a chain switch cannot prepare a transaction", async () => {
  const { provider } = mockWallet({ chainId: 1, ignoresSwitch: true });
  await assert.rejects(() => transactionWallet(owner, provider, async () => null), /Switch your wallet/);
});
test("cancelled reconnect and changed accounts cannot reuse reviewed recipients", async () => {
  await assert.rejects(() => transactionWallet(owner, null, async () => null), /cancelled/);
  const { provider } = mockWallet({ account: other });
  await assert.rejects(() => transactionWallet(owner, null, async () => ({ owner: other, provider })), /Review the action/);
  await assert.rejects(() => transactionWallet(owner, provider, async () => null), /account changed/);
});
test("duplicate same-account events do not invalidate a signed-in session", () => {
  const address = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
  assert.equal(walletAccountChanged([address.toUpperCase()], address), false);
  assert.equal(walletAccountChanged([], owner), true);
  assert.equal(walletAccountChanged([other], owner), true);
});
