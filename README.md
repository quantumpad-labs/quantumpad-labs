# QuantumPad

Open-source quantum computing launchpad and compute workspace. See [open-source information](OPEN_SOURCE.md) and [MIT license](LICENSE).

**The market for machine power.**

A Next.js compute terminal with real provider observations, cluster planning, wallet identity, provider-side provisioning controls and canonical job receipts. No seeded live prices, fake jobs or synthetic historical charts.

Production: [quantumpad.online](https://quantumpad.online). The public [playground](https://quantumpad.online/playground) runs actual CPU/WebGPU computation and local DistilBERT sentiment inference with no wallet. Neon persists accounts and observations. The existing Vercel Pro plan supports the minute-level scheduler. Visitors can connect their own Vast.ai account for self-service rentals; operator-funded rentals remain separately gated.

## Play now

- `/playground`: real matrix multiplication with output verification, measured timings, heatmap and downloadable result; CPU and WebGPU engines. Local AI inference uses pinned Transformers.js 3.8.1, ONNX/WebAssembly and a public quantized DistilBERT model. Model files download from Hugging Face (~67 MB) on first use; text stays in the worker. Runs are cancellable, bounded, and not presented as cloud jobs or certified benchmarks.
- Download `/downloads/exaflop-lab.ipynb` and upload it in Colab or Jupyter to execute the PyTorch experiment. CPU works; GPU availability depends on the hosting account. No cloud capacity is rented by the notebook.
- `/settings#connect-provider`: wallet sign-in, verify your Vast.ai key using a read-only authenticated account request, then encrypt it with AES-256-GCM. Each credential is bound to its wallet and provider. Configure rental budgets and use `/build` to search your private offers and explicitly launch.
- The builder also exports a configuration and links to RunPod/Vast.ai checkout. These are external checkout handoffs: users enter the configuration, approve billing and terminate resources at the provider. QuantumPad does not claim these external rentals are tracked jobs.

## Quantum workspace

`/quantum` is linked from the globe, feature navigation and command search. It preserves the existing GPU marketplace and adds:

- A bounded browser statevector simulator (1–8 qubits / 64 gates), Bell/GHZ/interference/Grover presets, editable gates, ideal probabilities, shot sampling, independent readout flips and reduced-qubit Bloch vectors.
- OpenQASM and request exports; imported result histograms and total-variation comparison against the same circuit's ideal distribution. Imported files are user-supplied, not independently verified.
- IBM Quantum / Amazon Braket access instructions and a downloadable Python runner for authenticated device discovery, explicit-confirmation submission, status, results and cancellation. Credentials stay in the user's local environment. Device catalog imports are dated snapshots, not a live connection or invented regional QPU capacity.
- A CUDA environment preset in Workloads/Builder for Qiskit Aer GPU simulation, and an exponential memory planner. SDK installation and runner transfer happen through the user's provider tools. The starter runner is bounded to 8 qubits; planning larger circuits does not change that limit.
- Local QAOA (two-node MaxCut) and VQE (one-qubit Hamiltonian) parameter sweeps with computed traces, plus an AWS Hybrid Jobs VQE runner with explicit billing confirmation and bounded evaluations.

See [the downloadable setup guide](public/downloads/quantum-guide.md). Python 3.12 is recommended. Real QPU and cloud hybrid execution require provider credentials, permissions, quota and billing; they are external runner workflows, not in-browser launches or QuantumPad GPU jobs. No quantum hardware run has been verified using operator credentials. Local simulation is not quantum hardware or evidence of quantum advantage.

## Run locally

Requires Node.js 22+ and pnpm 10.17.1+.

```sh
pnpm install
cp .env.example .env.local
pnpm dev
```

The public RunPod GPU catalog is queried without credentials. It currently accepts anonymous read-only GraphQL requests; this is not an access guarantee and failures are shown explicitly. Vast.ai and Lambda require server-side API keys. Without a database, public discovery, filters, the builder, cost estimates, model estimator, local watchlist and documentation remain usable. Account writes fail closed with a configuration message.

## Persistence

Create a PostgreSQL database, set `DATABASE_URL`, then run:

```sh
node --env-file=.env.local --import tsx scripts/migrate.ts
```

The migration is idempotent. PostgreSQL holds wallet challenges, session hashes, API key hashes, expiring quotes, jobs, saved configurations, policies, alerts, webhook records, rate counters and time-stamped market observations. Never expose this database directly to browser clients. Database credentials are server-only. Apply provider-side backups and encryption at rest.

## Provider support

| Provider | Discovery | Provisioning in QuantumPad |
|---|---|---|
| RunPod | Public secure-cloud GPU prices and stock signals | Adapter implemented; UI/API gate remains closed because catalog prices omit storage and location guarantees |
| Vast.ai | Wallet-scoped authenticated offers, whole-node pricing, specs, reliability | Self-service create, inspect and terminate; visitor supplies their own account key, explicit confirmation, spending limits and healthy scheduler |
| Lambda | Authenticated instance prices, specifications and available regions | Discovery only; machine bootstrap / SSH key lifecycle is not connected |
| Akash, Hyperstack, Salad, TensorDock, io.net, Fluidstack, CoreWeave, Golem | Researched with official documentation links | Not integrated; never represented as connected |

Provider inventory is cached for 60 seconds per server process. Quotes force a fresh check. RunPod stock levels are not counts; capacity remains null. Hardware variants share a market family but retain their offer-specific memory. Prices are USD per whole node-hour in normalized offers and USD per GPU-hour in market aggregates.

## Job authorization and billing

1. Sign in with an EVM wallet on Robinhood Chain using a server-generated, single-use, five-minute challenge.
2. Request a two-minute quote tied to an exact provider offer and disk allocation.
3. Review and explicitly confirm estimated provider billing. A self-service rental bills only the visitor's connected provider account. QuantumPad does not collect an onchain deposit or claim that providers accept Robinhood Chain.
4. Self-service uses `ENABLE_SELF_SERVICE=true` and a wallet-owned credential. Shared operator credit additionally requires `ENABLE_PROVISIONING=true` and the wallet in `PROVISIONING_WALLETS`. Both require `SCHEDULER_ENABLED=true` and a healthy heartbeat.
5. Self-service launches enforce per-job, daily, duration, hardware/provider and regional limits even for interactive wallet users. The policy's enable toggle separately authorizes API-key launches. PostgreSQL locks serialize budgets, quote consumption and global admission (20 active jobs, below the worker's 25-job batch limit). Credentials cannot be replaced/deleted while their jobs remain active.
6. A provider creation request is dispatched once. Ambiguous responses enter `RECONCILIATION_REQUIRED`; never blindly retry a launch. Find `exaflop-<job-id>` in the provider console.
7. The scheduler polls job state and terminates jobs at the requested duration. Provider outages or delayed scheduling can cause overrun. The policy caps quoted reservations, not unmetered network charges or a prepaid balance.

Stopping an instance terminates the rental and can delete provider-local storage. Export your results first. The UI asks for explicit confirmation. Receipt amounts are usage estimates rather than provider invoices. Reconciliation against provider billing is required before treating them as final accounting.

## Scheduling

`GET /api/cron` requires `Authorization: Bearer <CRON_SECRET>`. The included Vercel Cron runs every minute on the existing Pro plan. Vercel adds the configured authorization header automatically. A database lease prevents overlapping runs. Job polling and runtime termination happen every minute; public observations are bulk-ingested every five minutes and retained for 30 days.

A successful scheduler heartbeat within the preceding three minutes is required for a launch. `/api/health` exposes scheduler freshness without credentials. Monitor failures independently; scheduling and provider delays can cause runtime overruns. The current cron handles at most 25 jobs and 10 webhook attempts per call, bounded by a delivery time budget. Larger volumes require a dedicated worker and higher admission limit.

The same scheduler expires quotes, evaluates market alerts, records lifecycle events and delivers signed webhooks. Job polling is prioritized ahead of market ingestion, and unsuccessful job reconciliation prevents a healthy scheduler heartbeat.

## Robinhood Chain

Verified from [official network documentation](https://docs.robinhood.com/chain/connecting/) on 2026-10-03:

| | Mainnet | Testnet |
|---|---|---|
| Chain ID | 4663 | 46630 |
| Gas token | ETH | ETH |
| Public RPC | https://rpc.mainnet.chain.robinhood.com | https://rpc.testnet.chain.robinhood.com |
| Explorer | https://robinhoodchain.blockscout.com | https://explorer.testnet.chain.robinhood.com |

Set `NEXT_PUBLIC_CHAIN_NETWORK=testnet` for testnet. For production traffic configure `ROBINHOOD_RPC_URL` with a dedicated provider endpoint. The public RPC is rate limited.

Wallet signatures provide identity and authorization. Ended jobs can optionally be attested with a zero-value self-transaction whose data is the canonical receipt hash. The wallet must explicitly approve gas. The backend verifies transaction sender, destination, value, data and successful inclusion on the selected chain before storing its hash. No invented contract address is used. This is **Job Receipt Attestation**, not cryptographic proof of physical GPU execution. A receipt hash can be independently recomputed from downloaded JSON using the ordered canonical fields in `src/lib/jobs.ts`.

## Developer API

See `/developers` for interactive key management and endpoint documentation. A typed extractable client is in `src/lib/client.ts`. Agents should call `/api/my/offers` for their wallet's connected provider offers; `/api/offers` remains the public catalog.

```ts
import { Exaflop } from './src/lib/client';
const exaflop = new Exaflop({baseUrl: 'https://your-exaflop-domain', apiKey: process.env.EXAFLOP_API_KEY!});
const { offers } = await exaflop.offers({hardware:'H100',quantity:8,durationHours:10,strategy:'cheapest'});
// Confirm availability and select an offer before requesting a quote.
const quote = await exaflop.quote({offerId:offers[0].id,durationHours:10,disk:20});
```

Write actions accept `Authorization: Bearer exf_…`. Browser sessions use an HttpOnly, SameSite=Strict cookie and origin validation. API keys are shown once, SHA-256 hashed and revocable. Rate limits are persisted, with a default of 60 requests per minute per key. A policy deny returns 403; stale quotes return 409; rate limits return 429; unconfigured services return 503.

Webhook endpoints are public HTTPS only. Set `WEBHOOK_ENCRYPTION_KEY` to 32 random bytes encoded as 64 hex characters. Signing secrets are AES-256-GCM encrypted at rest. Delivery validates public IPv4 destinations, pins the DNS result into TLS, rejects redirects and retries at most five times. Verify `X-Exaflop-Signature` as HMAC-SHA256 over `<timestamp>.<raw-body>`, reject old timestamps and deduplicate event IDs. Existing events within the last day may be replayed after registration. Private-network and IPv6-only webhook destinations are deliberately unsupported.

## Product coverage and honest limitations

Implemented routes: `/`, `/markets`, `/markets/[hardware]`, `/build`, `/workloads`, `/providers`, `/providers/[provider]`, `/index`, `/arbitrage`, `/calculator`, `/estimator`, `/jobs`, `/jobs/[id]`, `/dashboard`, `/saved`, `/watchlist`, `/alerts`, `/developers`, `/settings`.

- Deterministic search; no LLM dependency. Model VRAM estimates disclose architecture-dependent assumptions.
- Single-node offer routing with whole-node cost, memory, CPU, storage, region and budget constraints. Unknown benchmarks cannot become guaranteed performance rankings.
- Cluster rack visualization scales with requested quantity; this does not assert actual node existence or cross-provider networking.
- Markets and chart periods derive from observations. No backfilled price history. 24-hour changes need a baseline within a two-hour tolerance.
- Authenticated saved machines, local hardware watchlist, wallet jobs, spend/GPU-hour estimates, hardware/provider breakdowns and in-app market alerts.
- Job events and signed webhooks. Market alert rules currently support price, capacity and availability. Additional spend/long-running rule configuration and regional/provider watchlists are not yet exposed.
- Provider telemetry is shown only when returned. Log adapters currently report unavailability. SSH, Jupyter links, restarts, distributed training orchestration and provider invoice reconciliation are not exposed.
- No escrow, deposit contract, fiat checkout, automatic fund transfer, model-performance guarantee or chain-based physical-compute proof is claimed.
- Self-service Vast.ai lifecycle and concurrency are verified against mocked provider HTTP in an isolated database schema. A funded real-provider rental has not been executed by the build agent. Provider credentials, credit and workload compatibility remain the visitor's responsibility. Onchain attestations still require wallet gas approval.

## Validation and deployment

```sh
pnpm test
pnpm typecheck
pnpm build
```

Tests cover price normalization, empty markets, cluster constraints, unknown memory, budgets, parsing, memory estimation, policy boundaries, canonical receipts, public catalog status, webhook URL/DNS restrictions and payload signatures. Tests use clearly identified fixtures; fixtures never enter runtime feeds.

The database-backed integration checks in `scripts/integration.ts` verify real wallet signatures, nonce replay rejection, sessions, persisted saved machines, cross-wallet isolation, API-key hashing/revocation, session-only policy controls, quotes from live offers, disabled provisioning and stored history. They use temporary generated accounts, clean up their own records, and never launch paid compute. Run against a local server with `node --env-file=.env.local --import tsx scripts/integration.ts`.

GitHub Actions runs tests, type checks and a production build. Import `quantumpad-labs/quantumpad-labs` into Vercel with the Next.js preset and the included configuration. Public discovery works without private provider keys. Configure `APP_ORIGIN` to the exact production origin, `DATABASE_URL`, `CRON_SECRET` and desired provider keys, migrate the database, then redeploy. Keep provisioning off until the scheduler, credentialed adapter and billing limits are verified.

`scripts/self-service-check.ts` verifies credential isolation, private inventory, healthy-scheduler enforcement, duplicate-launch prevention, budget limits, active-key protection, deadline termination and idempotent stop in a temporary isolated PostgreSQL schema. All provider HTTP is mocked, and the test schema is removed. CI runs it against a disposable PostgreSQL service.

Provider connection endpoints: session-only `GET/POST /api/connections`, `DELETE /api/connections/:id`; authenticated private discovery `GET /api/my/offers`. Secrets are never returned. `WEBHOOK_ENCRYPTION_KEY` also encrypts provider credentials with explicit purpose/wallet/provider binding; retain this key for active rentals.

See [provider research](docs/provider-research.md) and [architecture](docs/architecture.md).

## Genesis token launchpad

Open `/launchpad` from the Earth menu, feature navigation, search, or Quantum Lab. Seven creation paths cover hardware genesis, cross-machine records, simulator/hardware comparisons, software releases, benchmarks, hybrid stacks, and a proposed compute roadmap. Drafts save locally or export to JSON. Publishing requires a signed wallet session and database storage; the public directory contains actual published records only.

A published manifest is immutable through the application. Its canonical JSON SHA-256 commits the token terms, creator, timestamp, stack and optional experiment results. Deterministic `orbital-v1` SVG artwork derives from that hash. Results are creator-submitted, may predate publication, and are not independently authenticated with IBM or Braket. Stack selection does not execute external software. Quantum Lab supplies browser simulation and downloadable provider runners; other stacks require a creator-owned workflow.

Creators can request a wallet-signed deployment on the configured Robinhood Chain. `contracts/GenesisToken.sol` uses pinned OpenZeppelin ERC-20 code and mints the entire fixed supply to the creator. It exposes an immutable genesis hash and no administrative mint, freeze, tax, or upgrade functions. Gas estimation and explicit wallet review precede deployment; uncertain transaction attempts are retained locally for recovery. Registration verifies the creator, exact creation bytecode/arguments, successful receipt, chain and three block confirmations. This is not an independent contract audit. No mainnet transaction is broadcast by automated tests.

`pnpm contracts:compile` reproducibly builds the pinned Solidity artifact and downloadable standard compiler input. Launchpad tests deploy to an in-memory local EVM and verify supply, hash, transfers, and rejection of mismatched deployment records. Published token pages now include fixed-price sales, sale-outcome escrow and Uniswap v2 liquidity/trading controls. Vesting, milestone arbitration, locked liquidity and compute reservations are not implemented. Compute budgets and milestones remain disclosures only. Provider credentials and existing paid-compute authorization remain unchanged.

Run `node --env-file=.env.local --import tsx scripts/launchpad-check.ts` for isolated database checks of authenticated publication, immutability, idempotency, public reads and record ownership. The temporary schema is removed afterward.


### Sale escrow, liquidity and trading

After token verification, the creator can configure and deploy `GenesisSale` from the project page. It uses a fixed whole-token-per-ETH rate, immutable soft/hard caps and a start/end window. The entire hard-cap token allocation must be approved and deposited before the start. Buyers contribute ETH; anyone can finalize after the deadline or at the hard cap. Success unlocks buyer token claims and creator proceeds. Failure unlocks individual refunds. Unsold-token recovery preserves outstanding buyer claims. Cancellation is allowed only before the start. This is outcome escrow, not milestone enforcement, and the custom contract is not independently audited.

Liquidity uses the official Uniswap v2 router on Robinhood Chain 4663. The UI checks its bytecode hash, factory and WETH address before enabling pool controls. Approvals are exact amounts and separate from deposits/swaps. Deposits, LP redemptions and swaps use explicit minimum amounts and a ten-minute on-chain deadline; swap quotes expire in the UI after sixty seconds. LP tokens remain in the supplying wallet and are not locked. Sale proceeds do not automatically seed liquidity.

Reference: https://developers.uniswap.org/docs/protocols/v2/deployments . `scripts/check-uniswap.ts` performs read-only deployment checks. The router/factory/WETH were verified on 2026-10-06; testnet has no configured DEX integration. Tests deploy official Uniswap artifacts to a local EVM and exercise adding/removing liquidity, buying/selling, slippage rejection, successful sale claims and failed-sale refunds. `scripts/launchpad-check.ts` verifies both token and sale registration against actual local EVM deployments in a temporary database schema. These checks never transact on mainnet.

### Integrated quantum launch markets

The launchpad now offers a native-ETH bonding-curve route with in-app launch, trading, graduation, Uniswap v4 swaps and creator fee claims. Existing independent token and refundable sale flows remain available. See [integration behavior, verification and limits](docs/integrated-launch.md).
