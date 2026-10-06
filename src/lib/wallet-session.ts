import { createWalletClient, custom, type Address, type EIP1193Provider } from "viem";
import { chain } from "./chain";

export type WalletSession = { owner: string; provider: EIP1193Provider };

export function walletErrorCode(error: unknown, code: number): boolean {
  let current = error;
  for (let i = 0; i < 10 && current && typeof current === "object"; i++) {
    const item = current as { code?: number; cause?: unknown };
    if (item.code === code) return true;
    current = item.cause;
  }
  return false;
}

export async function ensureWalletChain(provider: EIP1193Provider) {
  const client = createWalletClient({ chain, transport: custom(provider) });
  if (await client.getChainId() === chain.id) return;
  try {
    await client.switchChain({ id: chain.id });
  } catch (error) {
    // A rejected switch is not an unknown chain. Never open a second prompt.
    if (!walletErrorCode(error, 4902)) throw error;
    await client.addChain({ chain });
    await client.switchChain({ id: chain.id });
  }
  if (await client.getChainId() !== chain.id)
    throw new Error(`Switch your wallet to ${chain.name} before continuing.`);
}

export function walletAccountChanged(accounts: unknown, owner: string) {
  return !Array.isArray(accounts) || typeof accounts[0] !== "string" ||
    accounts[0].toLowerCase() !== owner.toLowerCase();
}

/** Reattach a wallet after reload without using stale React state or retrying a write. */
export async function transactionWallet(
  owner: string,
  provider: EIP1193Provider | null,
  connect: () => Promise<WalletSession | null>,
) {
  const session = owner && provider ? { owner, provider } : await connect();
  if (!session) throw new Error("Wallet connection cancelled. No transaction was sent.");
  // Recipients and approvals were reviewed for this owner. Never substitute another.
  if (!owner || session.owner.toLowerCase() !== owner.toLowerCase())
    throw new Error("Wallet connected. Review the action for this account before continuing.");
  await ensureWalletChain(session.provider);
  const client = createWalletClient({ chain, transport: custom(session.provider) });
  const [account] = await client.getAddresses();
  if (!account || account.toLowerCase() !== owner.toLowerCase())
    throw new Error("Wallet account changed. Review the action again with the selected account.");
  return { client, account: account as Address, address: account as Address };
}
