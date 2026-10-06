# Transaction and action verification — 7 October 2026

## Fixes

- Reattach a selected wallet after a page reload using the returned authenticated session, rather than stale React state. Reconnection no longer throws unconditionally before a trade.
- Validate the reviewed account and switch to the configured network before preparing a transaction. Only unknown-chain errors add a network; rejected switches do not trigger another prompt.
- Listen only to the selected wallet. Ignore duplicate account notifications; serialize logout before a new sign-in and prevent stale session reads overwriting it. Changing networks alone no longer logs the user out.
- Automatically register independent token and sale deployments after three confirmations. Keep transaction hashes for manual recovery if confirmation or registration cannot complete. Registration uses the mined replacement hash, including integrated launches.
- Clear the deployment retry lock only after a confirmed revert or explicit wallet rejection. Uncertain broadcasts remain recoverable without automatic resubmission.
- Refresh sale windows, claim availability, balances and curve phases periodically and when returning to the page. Wallet writes remain explicit.
- Estimate independent token deployment gas before persisting the pending request, so a preflight failure does not lock the launch.

## Verification

- `node --import tsx --test tests/*.test.ts`: local EVM token creation, successful/failed sales, buyer claims/refunds, creator proceeds, Uniswap v2 liquidity deposits/removals and buys/sells, authentication rules, provider handling, compute math, quantum simulations and wallet regressions.
- `node --import tsx scripts/check-curve-launch.ts`: 14 read-only mainnet simulation steps: launch, curve buy, approval, curve sell, fee distribution/claim, graduation, locked-pool verification, v4 quote/buy, bounded Permit2 approvals and v4 sell. No transaction broadcast.
- `node --env-file=.env.local --import tsx scripts/launchpad-check.ts`: isolated database and local EVM publication, ownership, deployment registration, immutable-term mismatch rejection and idempotency.
- `node --env-file=.env.local --import tsx scripts/self-service-check.ts`: isolated database with provider calls mocked; encrypted connections, quote ownership, exactly-once job dispatch, budget checks, scheduler deadline termination and idempotent stopping. No paid rentals.
- `node --env-file=.env.local --import tsx scripts/check-actions.ts`: generated test-key signatures, custom-domain authentication, session cookies/restoration, nonce replay rejection, machines, alerts, protected endpoints, API-key creation and logout in an isolated database schema.
- Production API health, launch directory and markets returned HTTP 200; public RPC allowed browser requests from the production origin.
- Browser smoke check: software launch editor reaches a valid review, wallet chooser opens, no browser console errors in that check. No wallet extension is installed in the verification browser.
- Production build and TypeScript checks.

## Limits

These checks do not sign real user-wallet transactions, move real funds, open financial positions or rent paid compute. Live execution still depends on wallet support, balances/gas, liquidity, current contract phase/terms and provider access. There is no leveraged-position feature in this codebase; token swaps and liquidity shares are the implemented market operations.

The initial sandboxed test attempt failed inside the Windows runtime before any test ran (`uv_os_get_passwd`). The same suite ran successfully with normal host permissions. Ganache used its JavaScript fallback because a native binary is unavailable for this Node version.
