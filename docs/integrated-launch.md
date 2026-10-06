# Integrated quantum launches

The launch editor now offers **Integrated curve** alongside the existing independent ERC-20 / fixed-price sale route. The integrated route uses the deployed pons v2 protocol on Robinhood Chain (4663), with the product's own interface. It does not embed or redirect to the protocol website. Public wallets and explorers can identify the underlying contracts.

## User flow

1. Choose one of the seven existing quantum/software genesis paths and a live curve preset.
2. Publish an immutable manifest with its preset, supply, launch fee and economics commitment.
3. Review and sign the factory launch in the creator's wallet. The token metadata includes the manifest SHA-256, public project page and generated artwork URL. This token does **not** expose the independent GenesisToken's `genesisHash()` method.
4. Buy or sell against the curve, with exact approvals, wallet-specific opening-tax quotes, minimum-output protection and partial-fill refunds.
5. Complete graduation if the automatic transaction leaves it pending. The project page exposes the permissionless completion action.
6. Trade the graduated Uniswap v4 pool from the same page. Sells use exact ERC-20 approval to Permit2 and an exact router allowance expiring after ten minutes. Swaps expire after ten minutes and reviewed quotes after sixty seconds.
7. Distribute eligible curve fees and claim credited ETH from escrow. The UI distinguishes pending fees from claimable balances. Pool fee conversion/distribution can require the protocol operator.

The integrated route initially supports native ETH pairs, zero creator tax and buybacks disabled. Custom pairing assets, configurable creator taxes, atomic launch-and-buy, buyback administration and migration/CTO administration are not exposed. These limitations do not affect the older independent route.

## Allocation and provenance

The entire integrated token supply goes to its curve. A reserved portion seeds permanently locked protocol liquidity at graduation; no initial supply goes to the creator. Curve purchases are trades, **not refundable fundraising deposits**. Fee escrow holds accrued trading revenue and does not enforce compute milestones. The older fixed-price sale route retains its own funding-success/refund rules and independently supplied Uniswap v2 liquidity.

Quantum evidence remains creator-submitted and is not independently authenticated. The manifest includes the evidence and seeds deterministic orbital artwork; neither the art nor the digest establishes certified quantum randomness. Evidence and existing records are not rewritten by this integration.

## Contract verification and sources

Primary references, checked October 6, 2026:

- [pons v2 integration documentation](https://docs.ponsfamily.com/v2)
- [pons first-party source](https://github.com/ponsdotdev/pons-labs), first-party contract files declare SPDX MIT; dependencies retain their own licenses. The application calls deployed interfaces and does not redistribute the Solidity stack.
- [Verified launch factory](https://robinhoodchain.blockscout.com/address/0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e?tab=contract)
- [Official Uniswap deployment list](https://developers.uniswap.org/docs/protocols/v4/deployments)
- [Verified Universal Router](https://robinhoodchain.blockscout.com/address/0x8876789976decbfcbbbe364623c63652db8c0904?tab=contract)

Factory, router, quoter and Permit2 runtime hashes are pinned in `src/lib/curve-launch.ts` and `src/lib/launch-v4.ts`; a mismatch disables transactions. The router's deployed `ExactInputSingleParams` includes `minHopPriceX36`, and this integration encodes that version explicitly. Factory registration requires exact transaction input/value/creator, a successful receipt, a factory-emitted launch event and three confirmations. A pending launch marker prevents automatic duplicate deployment after an uncertain wallet response.

Presets and fees are read on-chain. At verification the public preset was 1 billion tokens, 1% base curve fee, 0.0005 ETH launch fee, and 4.2 ETH graduation threshold; these are mutable for future launches and must not be treated as permanent constants. The immutable manifest pins the chosen economics and fee; changed terms require a new record.

The protocol has administrative controls, including future launch configuration and timelocked creator-fee reassignment. This integration is not an endorsement, partnership, independent audit or brokerage listing.

## Verification

- `node --import tsx --test tests/*.test.ts`: unit/security regressions and existing local-EVM lifecycle tests.
- `node --env-file=.env.local --import tsx scripts/launchpad-check.ts`: legacy publishing/registration against an isolated temporary database schema and local EVM.
- `node --import tsx scripts/check-curve-launch.ts`: real deployed contracts via **read-only** `eth_call` and `eth_simulateV1`, using temporary balance overrides. Covers launch, curve buy/sell, exact approval, fee distribution/claim, graduation, v4 quote, v4 buy/sell and bounded Permit2 allowances. No private key, wallet signature or broadcast is used.

The live simulation validates contract compatibility; it is not evidence of a paid production launch or a completed browser-wallet transaction. No funds were spent while implementing this integration.
