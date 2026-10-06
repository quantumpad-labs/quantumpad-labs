import { defineChain } from "viem";
const testnet = process.env.NEXT_PUBLIC_CHAIN_NETWORK === "testnet";
export const chain = defineChain({
  id: testnet ? 46630 : 4663,
  name: testnet ? "Robinhood Chain Testnet" : "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: [
        testnet
          ? "https://rpc.testnet.chain.robinhood.com"
          : "https://rpc.mainnet.chain.robinhood.com",
      ],
    },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: testnet
        ? "https://explorer.testnet.chain.robinhood.com"
        : "https://robinhoodchain.blockscout.com",
    },
  },
  testnet,
});
