# Sentinel Buddies — judge and operator guide

## One-minute product summary

**Meet your buddy, unlock the intel.** Sentinel Buddies is an NFT-linked AI agent experience: mint an NFT, unlock an agent account and holder intelligence tools. Holders monitor public account balances privately, request an AI explanation grounded in saved observations, and prepare a report for their NFT's agent to publish. The on-chain hash links exact report bytes to a publishing agent/token. It does not establish AI truth.

The demonstrated chain is: **real RPC samples → integer calculation → real NEAR AI response → agent #1 signed commitment → verified task-history match**. Publication requires the operator's local restricted key and explicit approval; it is not autonomous.

## Current product sections

Read the [README](../README.md) for the complete product overview, definitions and source map.

1. **Investigate:** read-only mainnet/testnet account permissions and finalized transaction findings. No model call or fund movement.
2. **Watch and explain:** recorded observations, deterministic comparisons, holder-requested AI and explicit report publication.
3. **NEAR Ecosystem Liquidity Intelligence:** wide saved balance-change map with full account table, plus a separate Ecosystem Pulse card for provider TVL, DEX-only volume, broader trading volume and revenue.
4. **Agentic Economy Intel:** additional activity/budget summaries **and** the full original health gauge, signals, confidence, coverage, calculator, component costs and cross-chain comparisons.

Do not treat coloured balance bands as transfer paths, TVL changes as proven capital flows, or the sampled health score as a census of NEAR AI agents. Mainnet ecosystem data and testnet report settlement are separate.

## Judge path A: no wallet, secrets or paid calls

1. Visit https://sentinel-body.vercel.app/collection → inspect six registered artworks, existing NFT owners and finalized block provenance. Do not assume all six NFTs have already been minted.
2. Visit https://sentinel-body.vercel.app/agent/1 → inspect Arctic and `agent-1.sntl-02e90eacb8.testnet`.
3. Open https://testnet.nearblocks.io/txns/EPrjhgDpKxA6s2PZwm9QvuiacqtRXYx1uyshv9ahN1zL → inspect signer, receiver, `publish_snapshot`, successful receipts and report hash.
4. With Node >=20.19 and a checkout, run `node scripts/check-submission-evidence.mjs` → public chain checks pass. It prints current ownership/supply rather than assuming they stayed fixed.
5. Inspect the source locations in the README. There is no claim that running generic unit tests alone reproduces paid inference or a live wallet transaction.

If an RPC or explorer is unavailable, record that failure and retry a read later. A network error is not a passing verification. The checker never silently invents an observation or retries a signed transaction.

## New mission-desk review (MIS01 source update)

After the additive migration, Worker deployment and frontend deployment, authenticate and open the Investigation Desk with an NFT you currently own. Collect evidence first: no model call is made. Inspect its readable facts, tool log and source notebook. Explicitly consent to AI only if you want a new synthesis. Reopen completed cases without another model charge.

Personal missions require saved watch selections and real observations; mark a personal case reviewed to establish the next comparison baseline. Ecosystem missions separate TVL, DEX-only volume, broader activity and revenue. An account mission's recent indexer sample is not a full ledger or a proven cause of a balance drop. Private cases do not transfer to another holder with the NFT.

The mission schema is not accepted by the old publication tool. Do not submit a case export to the local publisher or call it an on-chain report. See [BUDDY-MISSIONS.md](BUDDY-MISSIONS.md). New prompt/model quality and production CPU remain acceptance checks; mocked model tests do not prove live inference.

## Judge path B: holder demonstration

A holder wallet is required. The existing successful report belongs to `michaelomario.testnet`; its private payload is not exposed to all visitors. Do not ask for organizer signing keys.

- Connect and prove ownership in Vault → holder tools load.
- In the investigator, load the supplied agent-report transaction example → inspect finalized execution and fees without a model call or transaction submission.
- Inspect NEAR Ecosystem Liquidity Intelligence → compare source blocks, selected accounts and saved-price conversion.
- Inspect Ecosystem Pulse → distinguish DEX-only volume from the broader intents/bridge total; check provider URLs, data dates and any unavailable sources.
- Inspect Agentic Economy Intel → summary cards appear above the original health and cost details. Expand inputs and formulas; the saved budget summary does not track slider changes.
- Open private monitored accounts → continue with the evidence flow below.
- Inspect two observation rows → block heights, hashes, source URLs and exact arithmetic are visible.
- Expand AI execution history → select the existing completed report → inspect deterministic facts and code calculations separately from AI text. Reopening it does not call the model.
- Inspect the source references S1 and S2 and uncertainty statement. Equal balances do not prove no activity.
- In the report's Agent report execution history, click Check on-chain publication → require NFT #1 / `agent-1.sntl-02e90eacb8.testnet` and `PUBLISHED · ON-CHAIN MATCH`.

The successful example has report ID `b77c8c8a-aa63-41e8-b21b-addd225d2a94`, provider response ID `chatcmpl-dce56088-839a-4efc-920a-009d92542f51`, and 1,021 provider-reported total tokens. IDs identify the demonstrated run, not a promise that the UI will always show it as the newest report. Old failed authentication attempts are retained honestly in history.

## Evidence and verification boundaries

- **Public:** NFT ownership/agent mappings; artwork registry/hashes; commitment ID/hash/token/agent; transaction receipts; observed block references published with the commitment.
- **Private by default:** holder watch configuration, complete AI response, report packet and D1 task records.
- **Deterministic:** canonical serialization and SHA-256; BigInt balance delta and exact timestamp difference.
- **AI:** interpretation, possible causes and limitations, rendered as text. Valid source IDs are checked, but the model can still be wrong.
- **Execution attribution:** Worker collects; NEAR AI produces text; local process signs as the agent; contract records that agent. No claim of on-chain model execution.
- **Access:** the application checks current holder/token ownership. A function-call key alone does not cryptographically prove a report was consented to by the current holder; the operator/application remain trusted.

Report commitment: `buddy-report-3e62906f-f29a-472f-87d1-e5ef1da05b34`.

```text
fd14b92ed315ab1770a573b05aad87511e9dfba2859203a84a9d48907522c8df
```

For a deliberately provided private packet, `node scripts/check-submission-evidence.mjs --packet <path>` recomputes its canonical hash locally. Without that packet the script validates public attribution/hash records only. A SHA-256 match is not source-truth verification.

## Local publisher — operator only

Do not run this to judge the existing transaction; use the public checker. New publication consumes testnet gas and changes the latest contract commitment.

1. In the authenticated Vault, open a completed report and prepare a packet for a token the holder owns.
2. Keep the packet outside Git. Review it: private evidence and holder-at-preparation are included.
3. From the original private working project, run the publisher with `--packet <path>` **without** `--approve-publish` → verify expected NFT, holder, agent, snapshot ID and hash. No key is read in this mode.
4. Only after explicit approval, add `--approve-publish` → one transaction uses `keys/testnet.json`'s fresh restricted worker key, signing as the selected agent. Do not move keys to the public hosting export or Cloudflare.
5. The script records the transaction hash before broadcasting, waits for final execution and checks the commitment at the execution block. A journal already exists or outcome is uncertain → stop and inspect it. Never delete the journal just to retry.
6. Refresh Vault history and retain the transaction link. No NFT is minted or transferred by this process.

The script requires `scripts/near-tx.mjs` relative to the working directory. A downloaded publisher may live elsewhere; the working directory determines the private keystore location. This intentionally avoids distributing operator credentials.

## Runtime configuration / reproduction

The deployed backend is **Cloudflare**, not the older Node gateway. The repository includes source and the prebundled Worker. For an independent instance:

1. Provision your own D1 database and bind it as `DB` to a Worker; use your real deployment IDs, not template placeholders.
2. Apply the four SQL schema files in `hosting/cloudflare` in the order documented in the README.
3. Configure exact `ALLOWED_ORIGIN`; put `JWT_SECRET` and `NEAR_AI_API_KEY` in Worker secrets. `AI_ENABLED=0` keeps model calls off until ready. `MONITOR_ENABLED=1` enables collection independently.
4. Deploy `hosting/cloudflare/worker.mjs` with `nodejs_compat`, preserving the database binding. Schedule the due-work collector once/minute. Each watch targets approximately 15 minutes, not one observation/minute.
5. Set the frontend server's `GATEWAY_INTERNAL_URL` to your Worker URL. Do not expose secrets through `NEXT_PUBLIC_*` variables. Deploy the Next app with root `apps/web` and the monorepo install/build workflow.
6. Use a compatible testnet wallet and a holder of the configured deployed contract. This configuration does not provision a fresh contract or mint NFTs for you. Independent contract deployment is a separate funded testnet operation requiring review.

Worker source bundling uses esbuild (the submitted compiled bundle requires no build tool to upload):

```text
esbuild hosting/cloudflare/worker-source.ts --bundle --format=esm --platform=browser --target=es2022 --external:node:* --outfile=hosting/cloudflare/worker.mjs
```

A configured esbuild installation is required to run that command; it is not a runtime dependency. Build commands in the README cover the web app separately.

## Failure and safety notes

| What you see | Meaning / next step |
|---|---|
| Holder access denied | Connect the correct testnet holder and prove ownership. Connecting alone is insufficient. |
| No observations | Collector has not recorded evidence. Wait/check scheduling; do not fabricate a sample. |
| Stale observation | Historical evidence, not current balance. AI does not refresh it. |
| AI HTTP 401 | Provider credential rejected. Fix the server secret privately; do not remove prefixes from issued keys based on guesses. |
| AI quota limit | The bounded demo refuses more requests. Reopen a saved report; do not delete records to bypass budget accounting. |
| AI pending/failed | Not a completed explanation; an interrupted call can still incur provider charges. No automatic retry. |
| Prepared task | Packet exists, but publication has not been verified. |
| No retained commitment | May be unsubmitted or pruned from bounded history; inspect the known transaction receipt if available. |
| Commitment mismatch | Verification failed. Do not describe it as published correctly. |
| Shared or old product title | Website is Sentinel Buddies; some on-chain titles and technical identifiers still say Sentinel Body. |

A new post-upgrade mint, a post-upgrade transfer and a live low-balance threshold crossing are not claimed as completed tests. Production free-tier CPU/credit limits and model availability remain constraints. Independent model attestation is not implemented. No financial advice, trading, rewards or returns are promised.

## Suggested 90-second recording

1. **0–15s:** Collection, six artworks, two minted at the demonstrated state; show current remaining count.
2. **15–30s:** NFT #1 Arctic and dedicated agent account.
3. **30–50s:** Vault saved S1/S2 observations, zero delta and time interval.
4. **50–65s:** AI interpretation with citations, hypotheses and limitations. Show model/usage; do not expose secrets.
5. **65–85s:** Published agent #1 task and successful transaction/explorer signer.
6. **85–90s:** State the boundary: "AI-assisted monitoring with operator-triggered agent publication—not autonomous on-chain AI."

The existing older `docs/sentinel-demo.webm` is a historical asset, not evidence of this new flow. Record the current deployment if a fresh video is required; do not present that old file as the new AI/agent demonstration.
