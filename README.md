# Sentinel Body

**Own an agent NFT. Inspect its committed intelligence. Transfer its access right.**

Testnet research prototype: NEAR mainnet observations by default, NEAR testnet ownership and commitments. Not an investment product, autonomous trading system, or audited production deployment.

## Start here
- [Demo walkthrough](docs/DEMO.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Implemented methodology and discrepancies](docs/METHODOLOGY.md)
- [Threat model and deployment blockers](docs/THREAT_MODEL.md)
- [Delivery acceptance status](docs/ACCEPTANCE.md)
- [Source evidence](docs/SOURCES.md)

## What it demonstrates
A NEP-171 NFT represents a Sentinel agent. Minting provisions a child agent account. The recorded Genesis account has a restricted function-call key for publishing commitments, not a full-access key. A Node worker fetches data, computes three indices, stores a snapshot, hashes its canonical body and publishes its hash to a testnet contract. The browser can independently recompute the snapshot hash. The gateway serves delayed public data and holder-gated data.

**Important distinction:** the off-chain Node process computes the analytics; the account and contract enforce limited on-chain permissions. The implementation is not proof that a fully autonomous AI runs on-chain.

## Existing testnet identifiers (historical, not fresh deployment claims)
- NFT: `sentinel-body.testnet`
- Genesis: `agent-0.sentinel-body.testnet`
- Organizer: `sentinel-owner.testnet`
- Second demo account: `sentinel-second.testnet`

The original shared ZIP exposed testnet credentials. Treat them as compromised. Do not use them for trusted operations; rotate/reprovision safely. No milestone has rotated them. Old transaction strings may reflect a pre-M01 transaction-hash bug: independently verify explorer references, rather than treating every historical URL as evidence.

## Install and validate — PowerShell
Requires Node >=20.19 (Node 22 used in CI), compatible Corepack and internet. From the project root:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm test:transactions
corepack pnpm test
corepack pnpm typecheck:web
corepack pnpm build:web
```

These commands do not deploy or mint. Rust contract builds/tests require Rust and are best run in Linux/WSL; see [M02](docs/M02-REPRODUCIBILITY.md). Sandbox source is supplied but its compilation/execution remains unverified here.

## Local read-only demonstration
The gateway binds to 0.0.0.0; use a local firewall and do not expose ports to the internet. In terminal A, set environment variables explicitly (the scripts do not automatically load .env):

```powershell
$env:DEMO_MODE = "0"
$env:DEMO_REPLAY = "1"
$env:PUBLIC_DELAY_MINUTES = "15"
$env:JWT_SECRET = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
$env:ADMIN_TOKEN = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
corepack pnpm gateway
```

DEMO_REPLAY=1 prevents the automatic scheduler from starting; it is used here to avoid automatic publishing with exposed credentials. Do not invoke admin publish routes. In terminal B, from the same project root:

```powershell
$env:GATEWAY_INTERNAL_URL = "http://127.0.0.1:8787"
corepack pnpm web
```

Open http://localhost:3000. Inspect `/proof`, `/verify`, and `/agent/0`. Recorded snapshots may be old: inspect age/stale/replay labels and never claim they are newly collected data. No holder session is promised by this read-only setup.

## Snapshot verification
```powershell
corepack pnpm verify snap-1794522174-0ea7afea07f5
```
The CLI uses configured sources/RPC; unavailable endpoints can prevent verification. Hash match establishes payload consistency with a commitment, not source truth, unbiased analytics or oracle correctness. See methodology for exact hashing boundaries.

## Project map
| Directory | Purpose |
|---|---|
| apps/web | Next UI and API rewrites |
| packages/core | Hashing, schema, inputs, indices, cost model, SVG |
| services/agent | Worker, publisher, JSON-file vault, Fastify/auth |
| contracts | NFT and agent-controller Rust source |
| config | Source evidence, cohorts and assumptions |
| data/snapshots | Recorded real snapshot payloads |
| scripts | Build/deploy/verify utilities and transaction tests |
| deployments | Public deployment metadata, not credentials |

## Current limits
JSON-file persistence, not SQLite; stale/partial source fallbacks; fleet-only health proxy; unvalidated Rust sandbox; independent wallet signMessage path not end-to-end validated. M03 disables an insecure client-receipt authentication shortcut, so wallets relying on that shortcut can fail until independently verified authentication is wired/tested. DEMO_MODE defaults to enabled in code: explicitly turn it off outside an isolated demo. See threat model before any deployment.

MIT license. There is no persistent public production URL promised by this repository. Presentation assets are included in M04; see [media provenance](docs/MEDIA.md). The video is a historical screenshot slideshow, not a fresh continuous demo. For a clean source ZIP, use [the release checklist](docs/RELEASE-CHECKLIST.md).
