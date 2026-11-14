# Development guide

> **Name note:** the repository, packages and Rust crate are named `sentinel-body` because the product was renamed to *Sentinel Buddies* after the contracts were deployed. These identifiers are intentionally unchanged. Do not rename them without a state-preservation review. See the notice at the top of the [README](../README.md).

## Repository layout

| Path | Contents |
|---|---|
| `contracts/sentinel-body/` | Rust NFT contract (provisioning, ownership, restricted keys, publication checks, artwork registry) |
| `hosting/cloudflare/` | Cloudflare Worker source, D1 schemas and deployable bundle |
| `apps/web/` | Next.js frontend and public evidence routes |
| `scripts/` | Verification and publisher scripts |
| `docs/` | Documentation |
| `services/agent/` | Older Node runtime. **Not** the deployed runtime |

## Prerequisites

- Node **20.19 or newer** and Corepack
- Internet access (dependency downloads and Next font fetching)
- For contract work: Rust with the `wasm32-unknown-unknown` target

## Install, test and build the web app

From the repository root (the same commands work in bash, zsh and PowerShell):

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm test:transactions
corepack pnpm test
corepack pnpm typecheck:web
corepack pnpm build:web
```

Use the package-manager version pinned in `package.json`. These commands do not deploy, mint or call the paid model. A passing unit test is not proof of live wallet, model or network execution.

## Run locally

```bash
corepack pnpm web
```

Open `http://localhost:3000/collection`. The frontend's `/collection-state` route reads public testnet state. Other gateway-backed pages need a separately configured gateway, and the default local target is `http://127.0.0.1:8787`. This command alone does not reproduce full authenticated Cloudflare behaviour. Do not loosen production CORS to accommodate an unreviewed local origin.

## Hosted backend configuration

Source: `hosting/cloudflare/worker-source.ts`. Deployable bundle: `hosting/cloudflare/worker.mjs`.

A separate deployment needs its own Worker, D1 database and binding, exact allowed frontend origin and secrets. Apply the additive schemas **in order**: `schema.sql`, `schema-watchlist.sql`, `schema-ai.sql`, `schema-agent-reports.sql`, `schema-missions.sql`. Preserve existing tables when upgrading. `wrangler.jsonc` holds template values and is **not a turnkey production configuration**.

| Binding / setting | Purpose |
|---|---|
| `DB` | D1 binding |
| `ALLOWED_ORIGIN` | Exact frontend origin, no trailing slash |
| `JWT_SECRET` (secret) | Holder-session signing |
| `MONITOR_ENABLED=1` | Enable scheduled observation collection |
| Cron `* * * * *` | Check due work each minute. Target observation interval is 15 minutes |
| `NEAR_AI_API_KEY` (secret) | NEAR AI Cloud inference credential. Never a public frontend variable |
| `AI_ENABLED=1` | Opt in to model calls. Set `0` to stop new AI calls |

Mission tables are `buddy_profiles` and `buddy_cases`. Model attempts reuse `ai_reports` so quotas are shared. QUOTA01 and AUD01 need no further SQL migrations. Keep quota and audit history intact. Public `/chain-evidence` and `/ecosystem-metrics` routes run in Next.js, separately from the holder-gated Worker APIs.

No agent private key is stored in the hosted Worker. The local publisher reads the restricted key from the operator's private keystore only after explicit approval.

> ⚠️ **Never run `scripts/deploy.mjs` to inspect or upgrade the live demo.** It is an initial deployment and initialization workflow.

## Contract tests

With compatible Rust dependencies and the wasm target installed:

```bash
cargo test --locked --workspace --lib
cargo build --locked --target wasm32-unknown-unknown --release -p sentinel-body
```

`--offline` can be added when dependencies are cached. The build embeds `contracts/sentinel-body/res/agent_account.wasm`. Preserve the controller artifact and follow the documented build process for a fresh deployment. Do not substitute a rebuild into the live contract without a state-preservation review.

Fifteen NFT-contract unit tests and the metadata-upgrade build passed on the operator's Windows setup. A fresh contract-sandbox end-to-end run is not claimed.

## Source map

| Path | Inspect for |
|---|---|
| `contracts/sentinel-body/src/lib.rs` | Provisioning, ownership, restricted keys and publication checks |
| `contracts/sentinel-body/src/artwork.rs` | Append-only artwork registry, existing-token assignment, mint coverage |
| `hosting/cloudflare/platform.ts` | Holder authentication and on-chain access checks |
| `hosting/cloudflare/investigate.ts` | Read-only account/transaction checks and exact arithmetic |
| `hosting/cloudflare/watchlist.ts` | Collector, exact arithmetic, source provenance and warning status |
| `hosting/cloudflare/ai-analysis.ts` | Model prompt, consent, quotas, cache and output/reference validation |
| `hosting/cloudflare/ai-quota.ts` | Specific quota/cooldown diagnosis after atomic reservation rejection |
| `hosting/cloudflare/missions.ts`, `schema-missions.sql` | Mission plans, private preferences/cases, review baselines and bounded AI synthesis |
| `hosting/cloudflare/agent-reports.ts` | Token-specific task authorization, packet hash and publication history |
| `scripts/publish-agent-report.mjs` | Read-only preflight, explicit signing approval and final receipt checks |
| `scripts/check-submission-evidence.mjs` | Public verification without secrets |
| `scripts/check-chain-evidence.mjs` | Public packet validation and optional historical RPC rereads |
| `apps/web/app/chain-evidence/route.ts`, `apps/web/lib/chain-evidence.ts` | Block-pinned sampler, exact native deltas, fleet reads, raw evidence and caching |
| `apps/web/app/collection-state/route.ts` | Finalized collection-state read |
| `apps/web/app/ecosystem-metrics/route.ts` | Public provider fetches, per-source failure states and caching |
| `apps/web/lib/ecosystem-data.ts` | Provider validation, missing-value handling and DEX-only classification |
| `apps/web/components/account-investigator.tsx` | Guided investigation and Vault introduction |
| `apps/web/components/buddy-missions.tsx` | Mission desk, consent, source notebook, case history and private exports |
| `apps/web/components/evidence-panel.tsx` | Evidence classes, official reference links and direct-fleet evidence |
| `apps/web/components/liquidity-map.tsx` | Expanded balance map, sampled accounts and explanations |
| `apps/web/components/ecosystem-pulse.tsx` | TVL, trading/revenue cards, history and source details |
| `apps/web/components/agent-economy-summary.tsx`, `indices.tsx` | Summaries plus the original health/cost components |
| `apps/web/components/dashboard.tsx` | Separate ecosystem and agentic-economy sections |
| `apps/web/components/ai-explanation.tsx`, `agent-report.tsx` | Facts/AI separation and task-history UI |
| `docs/AUTHENTICITY-AUDIT.md` | Audit findings, corrections, independent checks and limits |
| `docs/BUDDY-MISSIONS.md` | Mission operation, privacy, tool coverage and deployment details |
