# Demo runbook

## Safe default: read-only local demo
Use README's two-terminal instructions. Set DEMO_MODE=0 and DEMO_REPLAY=1 explicitly; set private JWT_SECRET and ADMIN_TOKEN. Do not expose ports. This avoids automatic scheduling and organizer-demo actions; it does not remediate every admin route or exposed key.

## Three-minute walkthrough
1. **Landing / live:** explain delayed public data versus holder-only full-resolution access. Read actual snapshot timestamp and age aloud; old data is not live merely because the server is running.
2. **Proof:** select a recorded snapshot. Explain content_hash, publisher, observation network and settlement network. Click Re-verify in browser. A MATCH proves byte consistency, not correctness of the real-world observation.
3. **Verify:** paste a recorded snapshot ID, such as snap-1794522174-0ea7afea07f5. Network failure is not a hash mismatch: report inability to verify honestly.
4. **Agent console /agent/0:** inspect account permissions and commitment history. Distinguish restricted on-chain account from off-chain worker hosting.
5. **Vault / mint:** show the access gate without sending a transaction. For holder-only views, use existing recorded screenshots if fresh keys/authentication have not been prepared. Clearly label screenshots as historical.

## Historical transfer evidence
M01 records old holder HTTP 200, then 403 after transferring its last NFT; recipient HTTP 200; agent history retained; Genesis restored. The recipient retained other NFTs, so returning Genesis did not remove recipient access. See docs/screenshots/transfer-test.json and 10-/11- screenshots. Historical transaction strings were generated before the local tx-hash correction; do not promise those explorer URLs resolve without checking them independently.

M01 browser smoke validated landing/mobile, WebCrypto verification, vault, console and public verifier. It did not newly mint; mint screenshots come from an earlier run. These are not proof that every current branch/wallet path still works after M03's fail-closed receipt change.

## Do not improvise live minting with exposed keys
A new live transactional demo requires fresh/revoked credentials, verified contract configuration, clear account labels and an independently tested authentication path. M02 mint script is read-only unless explicitly executed. The organizer demo session is not the visitor's wallet and must never be represented as such.

M03 disables the client-receipt shortcut. A wallet without working signMessage can fail at the receipt fallback until its server-verified transaction path is wired and tested. Do not weaken verification to make a stage demo succeed.

## If something fails
- Empty public data: inspect delay threshold, saved snapshots, source/RPC status and age.
- 403 from vault: account has no NFT, session expired/revoked, or no holder proof; do not bypass the gate.
- 410 from attest-receipt: intentional M03 protection; use verified authentication, not fabricated receipts.
- 429/timeouts: wait or use configured provider fallbacks; label degraded evidence honestly.
- Build failure: preserve command and error, avoid unreviewed dependency upgrades.

## Media and public deployment
M04 includes presentation assets; see MEDIA.md and RELEASE-CHECKLIST.md. Any screenshot-based slideshow must be labeled as such, not described as an uninterrupted browser transaction recording. There is no permanent public deployment URL or hosted video URL promised in this milestone. Do not insert invented links.
