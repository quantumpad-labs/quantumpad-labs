# Architecture and trust boundaries

```
Browser / API client
  -> Next.js route handlers
      -> public provider discovery -> normalization -> router / market statistics
      -> wallet signature authentication -> PostgreSQL sessions / hashed API keys
      -> quote -> explicit approval -> policy + atomic reservation -> provider adapter
      -> jobs / control room -> canonical receipt -> optional wallet self-attestation

Authenticated scheduler
  -> provider observations -> PostgreSQL historical observations
  -> provider job polling and runtime termination
  -> market alert rules -> durable events -> signed HTTPS webhooks
```

## Critical invariants

1. Public market data can only originate from an actual provider response. No runtime fixture data.
2. Unknown numeric fields remain nullable. One stock signal is not an inventory count.
3. Search never pools nodes to satisfy a cluster request. A returned offer must independently satisfy the requested resources.
4. Provider secrets are server environment variables. Workload environment values are transient and are not persisted in receipts, quote records or job records.
5. All account reads and writes are owner-scoped. Session cookies are HttpOnly, and browser-origin checks protect write access. Key and policy management requires wallet sessions, never just an agent key.
6. A quote is consumed at most once. PostgreSQL advisory transaction locks serialize reservations for a wallet. A dispatch claim precedes the external provider mutation.
7. Provider creation timeouts are ambiguous. A reconciliation state is preserved; automated creation retries are prohibited.
8. Receipt data is canonical and non-sensitive. Hashes attest a record, not underlying physical GPU execution.
9. Webhook DNS is validated and pinned. Redirects, private addresses and implicit internal-network access are refused.

## Operational boundaries

This release is a functional terminal and guarded provider integration foundation. It is not an independently audited compute reseller or payment processor. Operator provider credit is never made available to arbitrary signed-in wallets. Keep the explicit provisioning allowlist small and verify actual provider lifecycle behavior before permitting paid usage.

The 60-second process cache is not a global cache. Rate limiting on authenticated requests is PostgreSQL-backed; use platform WAF/rate limiting for anonymous discovery at scale. Cron handlers are bounded by hosting execution limits; a queue-based worker is required for large deployments.

The initial schema is intentionally compact: flexible owner-scoped records store typed domain documents; dedicated tables handle uniqueness, rate counters and historical observations. For large datasets, partition historical observations by month and replace raw graph responses with time-bucketed summaries.

## Verified against the deployed database

Schema migration, real observation ingestion, wallet signatures and nonce replay rejection, owner-scoped persistence, API key hashes and revocation, real discovery quotes and closed provisioning gates have passed integration tests. Temporary test-owned records were removed. Production serves live RunPod discovery data and uses an isolated Neon Free-plan database.

## Validation still requiring external setup

- Simultaneous multi-instance paid launch tests with a credentialed provider sandbox.
- Credentialed Vast.ai provisioning/termination and resource pricing checks.
- Funding, signing and confirming a real Robinhood Chain receipt attestation.
- Live webhook delivery to a user-configured endpoint.

These are not simulated. UI and API error states make the missing dependencies visible.
