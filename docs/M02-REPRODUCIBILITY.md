# M02 — reproducibility and transaction safeguards

Apply after M01. This is a scoped increment, not a production-security certification.

## Delivered
- Four dependency-free Node regression tests: unsigned transaction hash; receipt failure detection; no new-nonce retry after lost broadcast response; unfinished execution status rejected.
- Transaction utility refuses to automatically re-sign and resend after ANY attempted broadcast fails. Inspect transaction/account state before retrying manually. This deliberately trades automatic failover for protection against duplicate execution. Read-only pre-broadcast endpoint fallback is retained.
- scripts/mint-genesis.mjs: read-only by default, exits without minting when token #0 exists. Explicit --execute requires ACK_FRESH_TESTNET_KEYS=YES, testnet metadata, and matching admin. Acknowledgement is NOT a cryptographic fresh-key check. Use genuinely new credentials; the old Drive credentials are exposed. No rotation is performed.
- Root package commands: test:transactions, typecheck:web, build:web.
- CI definition for Node tests/build and Rust unit/build checks, plus opt-in sandbox execution.
- Sandbox integration test source covering Genesis mint, transfer, holder change and stable agent association. This does not test gateway authorization; that is separate evidence from M01.

## Verified here
- Frozen-lockfile dependency installation: passed.
- 14 core tests and 6 gateway tests: passed.
- 4 transaction regression tests: passed using mocked RPC and ephemeral generated keys, no actual network/transactions.
- Production Next build: passed, including all app routes.
- Web TypeScript: passed.
- Genesis command syntax and --help: passed. Live mint execution NOT performed.
- Patch apply, second application (no changes), and conflict rejection: checked against reconstructed Drive + M01 baseline.

Logs are in docs/validation/M02-*.log. Build output is not included: regenerate it locally. Build-time success does not imply a working production gateway, a public deployment, or wallet integration acceptance.

## Not verified / remaining
The restored environment has no Rust toolchain. The new sandbox test is uncompiled/unexecuted here; it may need API or runtime adjustments. CI is supplied, NOT executed on a hosted repository. Existing Rust unit passes from earlier milestones do not validate this new test. Rust/sandbox acceptance remains open and must be closed before calling M02 fully validated across all stacks.

No fresh browser wallet signMessage test, independent security audit, key rotation, SQLite migration or public deployment occurred. Gateway demo endpoints remain inappropriate for a public production service. Disable DEMO_MODE and replace exposed credentials before trusted use. Production server startup and live proxy behavior on your Windows machine remain to be checked separately.

## Windows: local checks (no chain writes)
Open PowerShell:
```powershell
Set-Location -LiteralPath "C:\Users\DELL\Desktop\PROJECTS\Sentinel Body"
node --version
corepack --version
corepack pnpm install --frozen-lockfile
corepack pnpm test:transactions
corepack pnpm test
corepack pnpm typecheck:web
corepack pnpm build:web
node scripts/mint-genesis.mjs --help
```
Stop on any failed command. Node >=20.19 is required; Node 22 is used in CI. If corepack is unavailable, install a compatible Corepack release for your Node version before continuing. Do not change dependency versions or run automatic audit fixes merely to bypass installation errors.

The production build may download packages on first setup; you need internet. It does not need a wallet or keys. Do not run deploy, create-account, or mint --execute as part of these checks.

## Rust/sandbox checks (Linux/WSL recommended)
Install Rust stable and the wasm32-unknown-unknown target. From the project root in WSL/Linux:
```bash
cargo test --locked --workspace --lib
bash scripts/build-contracts.sh
cargo test --locked --manifest-path contracts/sentinel-body/Cargo.toml --test sandbox -- --nocapture
```
The local sandbox downloads a node binary; it does not use public testnet credentials or funds. Contract builds update the embedded controller WASM and mint storage cost; do not treat freshly rebuilt bytes as identical to historical deployed artifacts. Keep generated artifacts out of milestone merges.

## Genesis command
`node scripts/mint-genesis.mjs` makes read-only testnet queries. `--help` makes no network calls. The command intentionally does not deploy a contract, provision credentials, rewrite old deployment evidence, or claim full controller provisioning validation. After any executed mint, independently verify token and agent access-key state. On a broadcast error, inspect chain state rather than immediately retrying.

## Next increment
M03 will provide README, methodology, architecture, threat model and demo runbook. M04 will package presentation assets and final release checks. Carry the open Rust/sandbox acceptance item forward; do not mark it passed based only on the existence of source files.
