# Architecture — implemented system

## Data path
```text
RPC + price/model catalogs
          |
          v
Node worker -> inputs -> indices/cost model -> snapshot body
          |                                  |
          |                            canonical JSON + SHA-256
          v                                  |
JSON snapshot vault (persist first)           v
          |                       testnet publish_snapshot commitment
          v                                  |
Fastify public / holder APIs <------- on-chain view calls
          |
Next same-origin /api rewrite -> browser WebCrypto verification
```

## Ownership path
NFT mint -> controller subaccount provisioning -> token/agent registry. A restricted worker key publishes snapshots. NFT transfer changes holder eligibility; it does not migrate or magically run the Node worker on the new owner's machine. The original off-chain operator still controls hosting and data collection. Contract permissions and keys, not marketing language, define control.

## Packages and trust boundaries
- Core functions compute deterministic outputs for fixed inputs. Fetchers depend on external RPC/provider availability.
- Agent runtime reads config, mainnet inputs by default, and testnet fleet state. It persists a full snapshot before attempting commitment; commitment failure is recorded separately.
- Contracts manage NFT ownership, agent associations and snapshot commitments. Full payload availability is off-chain.
- Gateway performs public/delayed delivery and ownership checks. Holders authenticate via a short-lived token after proof. Browser localStorage stores session data; XSS would threaten those tokens.
- Next proxies to gateway using GATEWAY_INTERNAL_URL. Browser code should not use sandbox localhost to reach a remote backend.

## Storage and runtime behavior
VaultStore writes JSON files plus index.json under data/snapshots. This is not SQLite, not transactional storage, and not a multi-writer database. Use a single writer; concurrent writes/crashes can damage consistency. Back up payloads separately from on-chain metadata. The scheduler runs at ROUND_INTERVAL_MINUTES (default 30) unless DEMO_REPLAY is enabled. It is an in-process interval, not a durable job queue or failover service.

## Authentication
Challenge expiry is five minutes. JWT lifetime defaults to 600 seconds. Holder cache defaults to 30 seconds; transfer handlers invalidate entries after view confirmation, but external transfers/RPC lag can create a revocation delay. Multiple NFTs matter: transferring one does not revoke access if another remains.

M03 returns HTTP 410 from /api/auth/attest-receipt because untrusted client receipt JSON cannot prove a transaction. NEP-413 and the server-side transaction lookup path remain in source; live wallet compatibility must still be tested. The organizer demo receipt flow receives its result server-side; it remains privileged demo behavior, not proof of the visitor's identity.

## Deployment boundaries
Current code defaults are development-oriented: demo mode enabled, known JWT fallback, optional admin token, 0.0.0.0 binding. Explicit environment overrides and network isolation are mandatory even for a private demo. A production design needs fail-closed startup validation, rate limits, centralized challenge/cache storage, hardened admin routes and credential rotation. See THREAT_MODEL.md.

The chain stores commitments, not truth certificates. Anyone can independently compare bytes to a hash, but still trusts the data providers and operator for observation accuracy and completeness.
