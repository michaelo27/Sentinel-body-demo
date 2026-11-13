# Drive baseline audit and delivery plan

## Baseline
Inspected public download `Sentinel Body.zip`, 7,179,035 bytes, 99 entries.
SHA-256: `a9b366404de84c63c869c2cd856b90f0f477ed3dcb2e3d2dc2444b20bbe5e666`.
Paths begin directly with `apps/`, `contracts/`, etc.; there is no enclosing project folder in the ZIP. No path traversal or symlink entries were found.

## Urgent credential exposure
The publicly downloadable archive includes `keys/testnet.json`. Treat every credential in it as compromised. Do not publish or redistribute that archive. Restrict Drive sharing; keep any backup private. Use new accounts/keys for further trusted deployment or revoke exposed keys after verifying replacement access. Removing the file or adding `.gitignore` does NOT revoke on-chain access. No key rotation was performed by this delivery. All milestone ZIPs exclude secrets. Keep DEMO_MODE disabled on publicly accessible deployments: organizer demo endpoints intentionally exercise organizer accounts.

## What is already present
- Rust NFT and agent-controller contracts, embedded controller WASM, Rust unit tests.
- Core schema, canonical hashing, RPC/source fetchers, cost model, indices, SVG art, NEP-413 utilities and 14 core tests.
- Fastify gateway, JWT/holder auth, snapshot publisher and JSON-file vault; 6 gateway tests.
- Next app routes: landing, live, proof, verify, mint, vault, agent console.
- Testnet deployment metadata, two recorded snapshot payloads, source/methodology configs and SOURCES.md.
- Screenshots of proof/mint/vault, but the archived browser-test.json reports a failed transfer access check.

## What was missing or incomplete
- Final transfer/revocation verification and positive browser evidence.
- README, architecture, threat model, methodology explanation and demo runbook.
- CI workflow and a real sandbox integration test (test script references a missing sandbox target).
- scripts/mint-genesis.mjs (package.json references a missing script).
- Production build validation, independent wallet signMessage validation and public production deployment.
- SQLite persistence: current implementation is JSON files, not SQLite.
- A demo media asset and reproducible delivery/merge procedure.
- Production security review; this is a testnet prototype, not an audited production system.

## Delivery sequence (new delivery numbers, not old development milestone numbers)
1. **M01 — baseline repair and transfer evidence (this ZIP):** targeted gateway/transaction fixes, browser evidence, audit, conflict-checking merge tool.
2. **M02 — reproducibility and hardening (pending):** transaction regression coverage, mint entry point, CI, production build, sandbox tests and security review. Exposed credentials require operator action before trusted redeployment.
3. **M03 — documentation and handoff (pending):** README, methodology, architecture, threat model, demo guide and final acceptance matrix.
4. **M04 — presentation assets and final package checks (pending):** hero, GIF/video, release checklist and clean export instructions. Existing generated video is a screenshot slideshow, not a continuous session recording.

## M01 fixes and evidence
Gateway transfer handlers now inspect transaction failure, wait for RPC ownership views to reflect the transfer, then invalidate holder caches. They return an explicit `confirmed` field, which callers must check. A confirmed transaction is not a promise of instantaneous revocation for every RPC/cache path.

Transaction utility now reports endpoint errors and checks receipt failures. Its local transaction hash now hashes unsigned transaction bytes rather than signed bytes (NEAR transaction hash convention). Historical transaction strings in old evidence may therefore be incorrect explorer references; they are NOT independently verified transaction IDs. Snapshot content commitments and observed ownership/access checks remain separate evidence. Historical evidence is preserved, not rewritten to imply a new test run.

Transfer run observed: old holder HTTP 200 before transfer; HTTP 403 afterward; recipient HTTP 200; two commitments retained; restricted controller key retained; Genesis returned to organizer. Recipient still holds other NFTs, so it correctly remains a holder after returning Genesis.
Browser smoke passed for landing/mobile, WebCrypto MATCH, holder vault, agent console and public verifier, without captured browser errors. Existing mint screenshots are historical; this smoke run did not mint again.

Validation of this patch: 14 core and 6 gateway unit tests passed; web TypeScript check passed. Browser/transfer evidence predates the small transaction-hash correction. No new on-chain transaction was made to validate that correction; it is included as a code correction, not a claim of live validation. Production build, sandbox tests, fresh wallet signing and security audit remain pending.

## Delivery hygiene
M01 contains only listed payload files, not a full project. It does not delete keys, generated files or old failure evidence from your working folder. Before sharing a final project archive, exclude keys/, .env*, credentials, node_modules/, .next/, target/, tsbuildinfo and private merge backups. Keep .env.example. A later clean-export pass must check the final archive, not merely trust .gitignore.
