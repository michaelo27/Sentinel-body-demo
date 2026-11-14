# Limitations and verification status

This page is the single place for what has and has not been demonstrated. These limits are part of the evidence, not fine print. For what each kind of evidence proves, see the [README table](../README.md#what-the-evidence-does-and-does-not-prove).

## Verification status

| Capability | Status |
|---|---|
| Six distinct registered artworks; #0/#1 metadata upgrade without remint | Demonstrated. Owners and agent records were preserved during the upgrade |
| Live collection, mint availability, token-specific agent artwork | Deployed. Live collection confirmed, but individual screens may be affected by RPC or image availability |
| Private holder watchlists and repeated observations | Demonstrated in production. Two blocks shown in the AI report |
| Exact balance comparison | Demonstrated. Zero change across about 16 minutes |
| Original observation AI inference | Demonstrated. The provider reported 1,021 total input/output tokens for the original watch-report response. This is not the token count of the newer mission example |
| Mission AI transaction readout | Owner demonstrated a completed production response with source-linked findings after QUOTA01. Interpretation still requires review |
| Personal priorities, review baseline and ecosystem missions | Implemented. Mocked backend/privacy tests and live public-source collection passed. A complete production AI demonstration of each is **not** claimed |
| Block-pinned evidence service | Deployed endpoint returned available liquidity/fleet sources. Public checksum/arithmetic/count checker passed. Historical source rereads passed during development |
| Agent #1 publication and on-chain task-history match | Demonstrated with the linked transaction and independently checked |
| Read-only account/transaction investigation | Implemented. Live read-only and mocked backend checks passed |
| Expanded liquidity and agentic-economy UI | Deployed. Owner reviewed the updated presentation |
| Ecosystem TVL, trading and revenue integration | Deployed. Endpoint returned all three sources as available during the latest check. External availability and coverage can change |
| Low-balance warning | Implemented and local mock-tested. Production threshold-crossing test **not** demonstrated |
| New mint after the artwork upgrade | **Not separately verified.** Do not claim a post-upgrade mint test passed |
| Transfer after the upgrade | **Not separately demonstrated.** Do not claim end-to-end transfer testing |
| Autonomous per-NFT execution | **Not implemented.** Publication is operator-triggered |
| Independent AI attestation / truth verification | **Not implemented** |

## Operational limits

**AI usage**

- AI is holder-triggered, with consent and bounded input.
- Maximum output is 700 tokens for observation explanations and 1,200 for mission explanations.
- Results are cached and there are no automatic retries.
- Quotas: one new attempt per minute and ten per day per holder, ten per day globally and forty total demo attempts. **Failed attempts count.**
- These are application request limits, not a dollar cap on other uses of the API key.
- Credits, RPC availability and free-tier CPU limits can interrupt service.

**Watches**

- Three watches per holder and thirty globally.
- The collector handles at most three due watches per tick.

**Missions**

- Four mission write/collection operations per minute and one new case per 30 seconds.
- 30 cases per holder and 120 globally. Failed or interrupted collections remain counted.
- Up to 30 cases per buddy are listed.
- Personal collection reads up to two saved observations per selected watch.
- Evidence is capped at 20,000 characters per case.
- No scheduled AI mission and no automatic retry exists.

## Known limits of the evidence

- Model source-ID validation prevents fabricated reference IDs, **not all hallucinations**. Explanations remain unverified hypotheses.
- NearBlocks provides at most five recent activity records. They are not a complete ledger or proof of why a balance dropped.
- Saved reports can be stale.
- Private observations and AI reports are not automatically on-chain. Only explicitly published report packets receive commitments.
- D1 audit and quota records remain after a watch is removed, although they are hidden from the watch-linked UI.
- Snapshot history keeps only the newest configured entries (currently 50). Transaction receipts remain separate evidence when a commitment is pruned.
- Artwork uses content-hashed Vercel URLs. Hashes detect byte changes but do not guarantee permanent hosting.
- Administrators can append artwork and upgrade contract code.
- The old snapshot's hash was checked against the live contract and matches. That proves integrity, not every original source value.

## Naming

The product is **Sentinel Buddies**. Deployed metadata titles may still say **Sentinel Body**, and the repository, package and domain names keep their original identifiers, because the project was renamed **after** the contracts were deployed. See the notice at the top of the [README](../README.md). The retired `sentinel-body.testnet` and `sentinel-owner.testnet` accounts must never be used.
