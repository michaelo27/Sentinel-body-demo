# Acceptance status after M04

Delivery milestone numbers are package increments, not a blanket claim that old development milestones are complete.

| Area | Evidence / state |
|---|---|
| Drive baseline audit | 99 entries; exact archive hash in DELIVERY-AUDIT.md |
| M01 merge | User confirmed successful application on Windows |
| M02 merge | User confirmed successful application on Windows |
| Core/gateway tests | 14 + 6 passed in M02; rerun for M03 |
| Transaction regressions | 4 mocked tests passed; no fresh live mint |
| Production frontend build | M02 passed; not public deployment |
| Browser proof and transfer | Historical M01 evidence, not rerun after M03 |
| Rust/sandbox | New sandbox source exists, compile/run still pending |
| Hosted CI | Definition supplied; no hosted run claimed |
| Wallet signMessage | Independent end-to-end test pending |
| Client receipt fallback | Disabled in M03; compatibility follow-up required |
| Security | Exposed keys and development defaults block public production use |
| Persistence | JSON files, not SQLite |
| Methodology | Discrepancies documented; corrections require versioned implementation work |
| M03 documentation | README, architecture, methodology, threat model, demo runbook supplied |
| M04 presentation | Hero, historical GIF/WebM slideshow and allowlisted source exporter delivered; not a fresh live demo |

## Historical engineering summaries
**Contracts:** NFT, child-account provisioning and restricted publish permission implemented; historical native unit/testnet results exist. New sandbox coverage not yet executed. Contract ownership is not automatic transfer of off-chain infrastructure.

**Intelligence:** real-source collection, snapshot persistence, canonical hash and testnet commitments implemented. Health is a fleet-only proxy; window labels, configuration bounds and comparison cost scopes have discrepancies documented in METHODOLOGY.md. Do not mark intended analytics specification fully satisfied.

## M03 code change
Only runtime change is fail-closed HTTP 410 for the untrusted client receipt endpoint. No historical snapshots, source evidence, contract WASM or deployment metadata are rewritten. Existing tests do not constitute a complete security audit. A local HTTP probe can confirm route closure but cannot prove all other authentication routes secure.

## M04 packaging scope
Media provenance is in MEDIA.md. The source exporter was exercised against a reconstructed Drive + M01–M04 tree with no credentials copied into the test fixture. Exported file hashes were verified. Open Rust/security/wallet/methodology items remain open; no public deployment or key rotation occurred.
