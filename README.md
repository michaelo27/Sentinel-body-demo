# Sentinel Buddies

## Meet your buddy, unlock the intel

**More than an NFT. Your gateway to an agent account, verifiable intelligence, and a story written on-chain.**

**Mint an NFT. Unlock an AI agent. Explore NEAR with evidence, not guesswork.**

Sentinel Buddies is an **NFT-linked AI agent experience** on NEAR testnet. Each minted buddy has a dedicated NEAR agent account. Owning the NFT unlocks tools to investigate accounts and transactions, watch balances, ask AI to explain saved evidence, and prepare reports that the linked agent can publish as verifiable on-chain fingerprints.

The Vault also separates **NEAR Ecosystem Liquidity Intelligence** from **Agentic Economy Intel**: understand selected balance changes, ecosystem TVL, trading volume and revenue, then explore agent health and running costs without confusing one kind of data with another.

“Verifiable” means you can inspect sources, block references and publication evidence. It does not mean every AI interpretation is proven correct.

[Live app](https://sentinel-body.vercel.app) · [Collection](https://sentinel-body.vercel.app/collection) · [Arctic / NFT #1](https://sentinel-body.vercel.app/agent/1) · [Vault](https://sentinel-body.vercel.app/vault) · [Verified agent #1 transaction](https://testnet.nearblocks.io/txns/EPrjhgDpKxA6s2PZwm9QvuiacqtRXYx1uyshv9ahN1zL)

> **Start with the no-wallet walkthrough below.** A judge can inspect the collection, agent permissions and an actual report-publication transaction without minting, paying, supplying an AI key or obtaining a holder session.
>
> This is a testnet prototype. The Worker collects data, NEAR AI Cloud generates text, and an operator-triggered local process publishes as the NFT's agent. **It is not an autonomous AI running on-chain.**

## Evidence and authenticity — read this before judging the numbers

The Vault distinguishes **block-pinned chain readings**, **third-party provider metrics**, **custom models/estimates** and **AI interpretations**. They are not equally verified. [The authenticity audit](docs/AUTHENTICITY-AUDIT.md) documents findings, corrections, source coverage and reproduction steps.

AUD01 adds a fresh, reproducible native-NEAR liquidity sample (two actual block hashes, 1,200 blocks apart, exact integer deltas) and a separate current Sentinel fleet evidence card. Download raw RPC responses and check them with `node scripts/check-chain-evidence.mjs --packet <file> --reread` after deployment. No wallet or AI credit is required. The old snapshot's hash was checked against the live contract and matches, but that proves integrity—not every original source value.

The historical health gauge remains available as an explicitly labelled **custom model**: missing baselines previously produced neutral scores; confidence/coverage fields are design weights, not statistical confidence or an official NEAR rating. Recalculated cross-chain budgets now include the same AI/hosting plan and exclude rent reserves from recurring totals; they are still scenario estimates, not execution benchmarks.

Official BigQuery/Intents documentation was reviewed, but neither is falsely claimed as an active integration. BigQuery queries can cost money; the Intents Explorer requires a partner JWT. No paid infrastructure or new secrets were introduced. See the audit for the tested source paths and remaining limits. AUD01 must be deployed before the new evidence endpoint is available.

## At a glance — for human and automated reviewers

| Question | Answer |
|---|---|
| What is the product? | An NFT-linked AI agent experience with a holder intelligence Vault. |
| What does minting create? | A collectible NFT and its linked NEAR agent account; current NFT ownership unlocks the protected tools. |
| Where does it run? | NFT minting and report publication use **NEAR testnet**. Investigations support mainnet and testnet. Ecosystem liquidity metrics describe **NEAR mainnet**. |
| Where does AI run? | Off-chain, through NEAR AI Cloud, when an authenticated holder requests an explanation of saved observations. |
| What is recorded on-chain? | NFT ownership, agent mapping and explicitly published report commitments. Private report bodies are not automatically published. |
| Is the agent autonomous? | Not in this prototype. Publication requires an operator’s local restricted key and explicit approval. |
| Can judges review without a wallet? | Yes: collection, agent mapping, the demonstrated transaction and the public evidence-checking script. Private holder tools require ownership authentication. |
| What is new in the current UI? | Guided investigation tools; expanded liquidity map with account explanations; separate TVL/trading/revenue metrics; full agent health and cost intelligence with additional summary cards. |

## The problem and solution

A balance dashboard shows a number; an AI answer may offer a plausible explanation without evidence. Neither alone tells a holder what was actually observed, what was calculated, or who published the report.

Sentinel Buddies separates those responsibilities:

1. **Observe:** a read-only Cloudflare Worker saves NEAR account amounts and exact block references in D1.
2. **Calculate:** code computes the net balance change and elapsed block time, using integer arithmetic.
3. **Explain:** NEAR AI Cloud receives at most two saved observations and returns a separately labelled interpretation, hypotheses and limitations.
4. **Attribute:** the holder prepares a report for a specific NFT they own. Its linked agent publishes the report's canonical SHA-256 hash through a restricted function-call key.
5. **Verify:** execution history checks the on-chain report hash, token ID and publishing agent. Hash agreement establishes byte consistency and attribution, **not AI correctness or the cause of a balance change**.

## What your buddy unlocks

### Buddy Investigation Desk — tool-assisted missions

The MIS01 source update adds three practical capabilities without removing the existing intelligence tools:

1. **Investigate an account or transaction:** gather finalized state/permissions or transaction execution, compare a previous saved key check when available, inspect watched balance evidence and collect a bounded recent activity sample. Ask AI to turn these sources into findings, unresolved questions and next checks.
2. **Remember my priorities:** save selected watches, reporting focus and style for your buddy. A personal briefing compares recorded balances and the latest briefing you explicitly marked reviewed. It is on demand, not scheduled AI monitoring.
3. **Brief me on NEAR:** gather TVL history, tracked DEX versus broader trading activity and covered revenue, then request an evidence-linked ecosystem explanation.

**Two steps, clear consent:** collect evidence without an AI charge; inspect recorded facts, source gaps and the tool log; then explicitly request AI synthesis. Reopen a completed case without another model call. Cases and preferences are private to the creating holder and selected NFT; a new NFT owner does not inherit private history.

The model explains evidence gathered by a bounded server plan. It does not freely browse, hold signing keys, trade or invent missing history. NearBlocks provides at most five recent activity records, not a complete ledger or proof of a balance drop's cause. The existing AI quota is shared with missions, raised to ten per day per holder with approval, while retaining ten per day globally and forty lifetime attempts. Exact provider cost must be checked in provider billing; reported token usage appears in the case.

**Deployment/evidence status:** the owner confirmed MIS01/QUOTA01 deployment, successful transaction evidence collection and a completed source-linked mission AI readout. The readout also demonstrated why model statements still require review. Personal/ecosystem mission acceptance is not inferred from that one transaction test. Private case JSON is not an AG01 publication packet. The existing watch-report publication flow remains unchanged; mission cases are not claimed as on-chain publications.

See [Buddy missions: use, privacy, limits and deployment](docs/BUDDY-MISSIONS.md) for the full walkthrough and source map.


### 1. Investigate before you guess

Enter a NEAR account or transaction in the Vault. The read-only investigator explains what the chain records; it does not ask AI to invent a transaction story.

- **Account checks:** native NEAR amount, locked balance, storage use, contract presence and access-key permissions at a finalized block. Full-access and function-call keys are distinguished; a public key does not identify its human owner.
- **Transaction checks:** supply the transaction hash and signer account to inspect finalized status, actions, attached deposits, execution outcomes and burnt transaction fees. The displayed execution accounts are not automatically money recipients.
- **Safety:** these checks do not sign transactions, move funds or call the paid AI model. Protected access still requires a holder session. The interface displays up to 20 keys/actions; this is not a complete token portfolio, transaction-history index or security verdict.

### 2. Watch what changes, then ask your AI

Save accounts you care about, choose a low-balance warning threshold and compare genuine observations. The application calculates balance changes before asking the model to explain the evidence. AI text is shown separately from the recorded facts. With only one observation, there is no invented second reading.

When a useful explanation is ready, prepare a report for a specific NFT you own. An approved local publication can attach its fingerprint to that NFT’s agent identity. The fingerprint lets a verifier check matching report bytes and the publisher—not prove the explanation’s conclusions.

### 3. NEAR Ecosystem Liquidity Intelligence

**Where did the sampled balances move?** AUD01 prioritizes fresh block-pinned native NEAR comparisons, with an explicitly archived fallback. A full-width coloured balance-change diagram is followed by a full-width category/account table, a plain-English takeaway and expandable explanations of what to check next.

| Category | Accounts sampled | What the reading covers |
|---|---|---|
| Intents / solver hub | `intents.near` | Native NEAR change in the selected hub account, not total swap volume or solver revenue. |
| Liquid staking | `linear-protocol.near`, `meta-pool.near` | Selected contract balances, not all staking pools or all staked NEAR. |
| DeFi venues | `v2.ref-finance.near`, `dclv2.ref-labs.near`, `contract.main.burrow.near` | Selected trading/lending contract accounts, not their total deposits or trading volume. |
| Bridge / Aurora | `aurora` | One selected account, not all bridge assets or flows. |
| wNEAR reserve | `wrap.near` | The wrapped-NEAR contract’s native account balance, used as a reserve-account reading. |

**How to read it:** later balance minus earlier balance equals change. Green means an increase; rose/pink means a decrease. In AUD01, wider bands represent larger native-NEAR changes. Connecting bands group the readings visually; **they are not traced transfers between projects**. Zero net change does not mean zero transactions.

The headline adds the sample’s changes only when all selected account pairs are available. AUD01 uses two pinned block hashes exactly 1,200 heights apart and shows actual elapsed time. Its optional dollar figure uses a separately dated provider price, not guaranteed block-time pricing. The archived fallback uses the original saved conversion and intended roughly 12-hour window; it is explicitly labelled historical and not independently reread. A decrease is not automatically a loss, a sale, a hack or capital leaving NEAR.

#### Ecosystem Pulse — value held, traded and earned

A separate card retrieves public **DefiLlama** data through the frontend server’s `/ecosystem-metrics` route. This is independent of the saved account comparison.

| Metric | Meaning | Important boundary |
|---|---|---|
| Overall NEAR DeFi TVL | Dollar value locked in protocols covered by the provider’s NEAR view. | Not NEAR’s market cap or every asset on the network. |
| Tracked DEX volume · 24h | Sum of available 24-hour values for entries classified as `Dexs` in that view. Reporting coverage is displayed. | Excludes intents/bridge categories; missing values are not counted as zero. |
| Broader trading volume · 24h | The provider’s broader trading total. | Can include NEAR Intents, bridges and other categories; not pure DEX volume. |
| Covered revenue · 24h | The provider’s NEAR revenue aggregate under its definitions. | Not trader profit, NFT-holder income, or every business’s revenue on NEAR. |
| Liquidity direction | Daily TVL history, daily change and a prior-week comparison when available. | A change in dollar value, **not measured net capital inflow/outflow**. Prices, deposits, withdrawals and coverage can all affect it. |

The card includes DEX 24-hour/7-day breakdowns, broader trading and revenue entries, source links, retrieval time and available daily chart dates. Protocol rows can overlap or use different cutoffs; do not sum them to recreate aggregate totals. The 24-hour summary and latest daily chart date may use different periods.

Refresh retrieves data through a route cached for up to five minutes. An unavailable source stays unavailable; it is not replaced with fabricated figures. A new retrieval time does not guarantee a new provider observation. **These external metrics are not AI output or on-chain report commitments.** No net bridge-flow or complete ecosystem transfer graph is claimed.

### 4. Agentic Economy Intel

This is a separate section, not another name for ecosystem liquidity. **The new summary cards supplement the original detailed intel; they do not replace it.**

| Part | What you can inspect |
|---|---|
| Agent activity at a glance | Active/total sampled agents and the saved activity score. |
| Saved running-budget example | A quick monthly estimate from the saved scenario. It stays fixed when you change calculator settings below. |
| Full agent health | Score gauge, evidence confidence, coverage, sampled-agent count, individual signal breakdowns and sample-account information. |
| Interactive running-cost calculator | Workload sliders and model selection, network fees, AI usage, hosting, storage, cost per 1,000 actions and cross-chain comparisons. |
| Calculation details | Saved rates, inputs, formulas and available provenance. |

**The old health gauge is a custom weighted model**, not a security audit, live uptime guarantee or score for every AI agent on NEAR. Missing-baseline neutral defaults and duplicated publisher-share signals are disclosed. Coverage/confidence are developer-selected checklist weights, not statistical probabilities. The new block-pinned fleet card shows actual retained-publication counts separately.

**Running costs are budget estimates, not charges.** Network fees, AI usage and hosting contribute to the monthly plan. NEAR reserved for storage is separate from a monthly subscription cost. Changing sliders does not move funds or trigger paid inference. Recalculated cross-chain comparisons include the same AI/hosting plan and exclude storage/rent reserves from recurring totals; they still omit some execution-specific fees and do not establish a universal cheapest chain.

### A quick vocabulary guide

- **Agent account:** the NEAR account linked to a particular NFT. The AI model itself runs off-chain.
- **Snapshot / saved report:** readings captured at a recorded point in time; not automatically current.
- **Cohort / sample:** a selected group of accounts; not the entire sector.
- **TVL:** total value locked in the protocols included by the data provider.
- **Volume:** value traded during a stated period; not value remaining in the accounts.
- **Revenue:** the share counted as revenue under the source’s methodology; not all fees or profit.
- **Commitment / fingerprint:** a hash recorded on-chain to identify a report’s exact bytes.

## Try it in 3 minutes — no wallet required

| Step: do this | Expected result |
|---|---|
| 1. Open [Collection](https://sentinel-body.vercel.app/collection). | Six currently registered artworks, minted/unminted labels, owners for existing NFTs, pause/availability status and a finalized block number. The count can change; use the live reading. |
| 2. Open [NFT #1](https://sentinel-body.vercel.app/agent/1). | Arctic artwork from NFT metadata and the linked account `agent-1.sntl-02e90eacb8.testnet`. |
| 3. Open the [agent #1 transaction](https://testnet.nearblocks.io/txns/EPrjhgDpKxA6s2PZwm9QvuiacqtRXYx1uyshv9ahN1zL). | A successful transaction signed by **agent #1**, calling `publish_snapshot` on the NFT contract—not merely a Genesis #0 example. |
| 4. From a repository checkout, run `node scripts/check-submission-evidence.mjs`. | PASS checks for distinct artwork hashes, NFT #1 metadata/mapping, restricted agent permissions and the documented publication's signer/hash. No dependencies or secrets required beyond Node and internet. |
| 5. Open [Mint](https://sentinel-body.vercel.app/mint), without clicking mint. | Remaining registered IDs, the next artwork at the displayed block and a live availability panel. Wallet connection alone does not mint. |

**Expected seed state at the last verification:** 6 artwork entries; existing IDs #0 Original and #1 Arctic; next ID #2 Ember; minting unpaused. #3 Jade, #4 Royal and #5 Solar are registered for subsequent IDs. Four IDs remained; availability is not reserved for judges. Artwork can be appended, so six is not an immutable lifetime cap.

### Public evidence you can check independently

| Item | Value |
|---|---|
| Settlement network | NEAR testnet |
| NFT contract | [`sntl-02e90eacb8.testnet`](https://testnet.nearblocks.io/address/sntl-02e90eacb8.testnet) |
| Report publisher | `agent-1.sntl-02e90eacb8.testnet` |
| NFT / owner at publication | `1` / `michaelomario.testnet` |
| Role | `holder-monitoring-report-publisher` |
| Report commitment ID | `buddy-report-3e62906f-f29a-472f-87d1-e5ef1da05b34` |
| Commitment block | `277652553` |
| Methodology | `holder-monitoring-ai-v1` |
| Transaction | `EPrjhgDpKxA6s2PZwm9QvuiacqtRXYx1uyshv9ahN1zL` |

Report SHA-256:

```text
fd14b92ed315ab1770a573b05aad87511e9dfba2859203a84a9d48907522c8df
```

The demonstrated report used observations at blocks **277650217** and **277648579**. Both recorded **6.8894279455544266 NEAR**; code calculated **0 NEAR** net change across **960181575856 ns** (approximately 16 minutes). The AI correctly treated the cause as unknown: unchanged balances do not establish absence of transactions.

The private report body is **not public by default**. The public checker verifies the commitment and receipt, not the unseen body. If the holder deliberately provides its JSON packet, verify it locally without uploading it:

```powershell
node scripts/check-submission-evidence.mjs --packet "C:\path\to\buddy-report-3e62906f-f29a-472f-87d1-e5ef1da05b34.json"
```

Optional public image-byte verification (downloads images):

```powershell
node scripts/check-submission-evidence.mjs --media
```

## Holder walkthrough — do X → see Y

This path needs a **testnet wallet that currently owns a Sentinel NFT**. There is no universal demo login and no organizer private key is supplied. Judges without a holder wallet should use the public walkthrough; do not mint just to validate the existing evidence.

1. **Connect the holder wallet, then prove ownership in [Vault](https://sentinel-body.vercel.app/vault)** → a holder session opens. Connection alone does not grant access; ownership is rechecked on protected requests.
   - **Try a read-only investigation first:** choose an account and network, or load the supplied agent-report transaction example and click **Investigate now**. Inspect the source block, permissions or transaction outcomes before moving to monitoring.
2. **Under My monitored accounts, save a valid mainnet/testnet account and threshold** → the watch appears. The collector targets a 15-minute interval; it is not an immediate-refresh button. Wait for a genuine observation. Existing watches may already have history.
3. **Inspect two recorded observations** → see source RPC URLs, block hashes/heights, timestamps and the code-calculated change. With one observation, comparison remains unavailable. Stale/error states are explicit.
4. **In Explain my saved observations, choose the watch, read consent and click Explain saved evidence once** → NEAR AI supplies an interpretation below deterministic facts/calculations. Errors remain errors; no explanation is fabricated. A successful existing report can be reopened from AI execution history without another model call.
5. **Open a completed report, enter an NFT ID you own, consent and choose Prepare & download report packet** → a private JSON packet and a prepared task appear. This sends no transaction and incurs no new AI call.
6. **Have the configured operator run the local publisher's read-only preflight, then explicitly approve publication** → the local process signs as that NFT's agent using its restricted key. This is not an action every holder can perform without operator/key provisioning.
7. **Click Check on-chain publication** → `PUBLISHED · ON-CHAIN MATCH` only when the contract commitment matches agent, token and report hash. An unsubmitted packet, RPC failure or missing/pruned commitment is not labelled a successful execution.

8. **Explore the shared intelligence below the holder tools** → inspect the full-width liquidity map and its account explanations, the separate Ecosystem Pulse metrics, then Agentic Economy Intel with both summaries and the complete health/cost tools. Expand the source/methodology details and distinguish the saved readings from freshly retrieved external metrics.

See [Judge and operator guide](docs/JUDGE-GUIDE.md) for publisher commands and access boundaries. Private data, report packets and signing keys must not be committed to Git.

## Why NEAR / technologies used

- **NEAR accounts and subaccounts:** minting provisions `agent-<token_id>.<contract>` as a dedicated agent identity.
- **NEP-171 NFTs / NEP-177 metadata:** ownership and registered artwork are attached to token IDs; artwork follows a transfer rather than being permanently tied to a wallet.
- **NEAR function-call access keys:** the demonstrated agent has one key restricted to `publish_snapshot` on the NFT contract, with an allowance and no FullAccess permission.
- **Rust / near-sdk contracts:** record NFT ownership, agent mappings and bounded report commitments. The contract requires a registered agent signer/predecessor for publication.
- **NEP-413 wallet authentication:** signed challenges establish holder sessions; the hosted receipt shortcut and organizer demo transaction routes are disabled.
- **NEAR AI Cloud:** the deployed text-analysis path uses `Qwen/Qwen3-VL-30B-A3B-Instruct` through its OpenAI-compatible API. A successful live response and agent #1 publication were demonstrated. Model attestation is **not independently verified** by this app.
- **NEAR JSON-RPC:** finalized account observations with block-pinned timestamp provenance, plus read-only account/transaction investigations.
- **DefiLlama public APIs:** third-party mainnet TVL, trading and revenue data, fetched by a separate Next.js server route. No private holder data or AI credentials are sent to this provider.
- **Next.js/React + Vercel; Cloudflare Worker/Cron + D1:** UI, private holder APIs, off-chain collection, AI orchestration and execution records.

## Architecture and trust boundaries

```text
Holder wallet ── NEP-413 / ownership check ──> Cloudflare Worker + D1
                                                  │
                      Cron ── NEAR RPC observations│
                      Holder consent ── NEAR AI ───┤
                                                  ▼
                                     Private report + task packet
                                                  │ download
                                                  ▼
                                   Local operator / restricted key
                                                  │ agent-signed publish_snapshot
                                                  ▼
                                      NEAR testnet NFT contract
                                                  │ read-only verification
                                                  ▼
                                           Vault task history
```

The agent's **defined responsibility is report publication**. Collection and inference are separate off-chain operations. The existing restricted worker key may be shared across agent accounts; this is not independent key custody per NFT. Holder/report authorization is enforced by the application and local publisher, not atomically by the publication contract. Operator trust and ownership-change races therefore remain relevant.

The shared intelligence section mixes clearly separated sources: the balance map and agent-health report use a **saved snapshot**; Ecosystem Pulse fetches **third-party mainnet aggregates**; the cost tool calculates a **scenario using saved rates**. None is evidence that the holder AI just executed. Private watches and AI execution history are separate. The older Node runtime under `services/agent` is not the deployed Cloudflare runtime. Older milestone documents describe earlier states; this README and `docs/JUDGE-GUIDE.md` describe the submission deployment.

## Run and inspect the source

### Fastest check: public evidence only

Requires Node **>=20.19**, outbound HTTPS and a repository checkout. No package installation, wallet, AI credit or credentials:

```powershell
node scripts/check-submission-evidence.mjs
```

### Public ecosystem data route

Open [the deployed ecosystem metrics endpoint](https://sentinel-body.vercel.app/ecosystem-metrics) to inspect its JSON response. It exposes public aggregates only, not private holder watches or reports. Check each source’s `status`, `fetched_at`, source URL and record dates. A successful HTTP response can still contain an unavailable individual source.

Source endpoints:

- TVL: `https://api.llama.fi/v2/historicalChainTvl/Near`
- Trading: `https://api.llama.fi/overview/dexs/Near?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true`
- Revenue: `https://api.llama.fi/overview/fees/Near?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyRevenue`

### Install, test and build the web application

From the repository root with Node, Corepack and internet access:

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm test:transactions
corepack pnpm test
corepack pnpm typecheck:web
corepack pnpm build:web
```

Use the package-manager version pinned in `package.json`. These commands do not deploy, mint or call the paid model. Dependency downloads and Next font fetching require internet. A passing unit test is not proof of live wallet/model/network execution.

For a **local frontend inspection**:

```powershell
corepack pnpm web
```

Open `http://localhost:3000/collection` → the frontend's `/collection-state` route reads public testnet state. Other gateway-backed pages need a separately configured gateway; the default local target is `http://127.0.0.1:8787`. Do not expect full authenticated Cloudflare behaviour from this command alone or change production CORS to accommodate an unreviewed local origin.

### Hosted backend configuration

Source: `hosting/cloudflare/worker-source.ts`; deployable bundle: `hosting/cloudflare/worker.mjs`.

A separate deployment needs its own Worker, D1 database/binding, exact allowed frontend origin and secrets. Apply the additive schemas in order: `schema.sql`, `schema-watchlist.sql`, `schema-ai.sql`, `schema-agent-reports.sql`. Preserve existing tables when upgrading. `wrangler.jsonc` contains template values, **not a turnkey production configuration**.

| Binding / setting | Purpose |
|---|---|
| `DB` | D1 binding |
| `ALLOWED_ORIGIN` | Exact frontend origin, no trailing slash |
| `JWT_SECRET` (secret) | Holder-session signing |
| `MONITOR_ENABLED=1` | Enable scheduled observation collection |
| Cron `* * * * *` | Check due work each minute; target observation interval is 15 minutes |
| `NEAR_AI_API_KEY` (secret) | NEAR AI Cloud inference credential; never a public frontend variable |
| `AI_ENABLED=1` | Opt in to model calls; set `0` to stop new AI calls |

No agent private key is stored in the hosted Worker. The local publisher reads the existing fresh restricted key from the operator's private keystore only after explicit approval. **Never run `scripts/deploy.mjs` to inspect or upgrade the demo:** it is an initial deployment/initialization workflow.

### Contract tests

With compatible Rust dependencies and the wasm target already installed:

```powershell
cargo test --locked --workspace --lib
cargo build --locked --target wasm32-unknown-unknown --release -p sentinel-body
```

`--offline` can be added when dependencies are cached. The build embeds `contracts/sentinel-body/res/agent_account.wasm`; preserve the controller artifact and use the documented build process for a fresh deployment. Do not substitute a rebuild into the live contract without state-preservation review. Fifteen NFT-contract unit tests and the metadata-upgrade build passed on the operator's Windows setup; a fresh contract sandbox end-to-end run is not claimed here.

## Evidence status and limitations

| Capability | Submission status |
|---|---|
| Six distinct registered artworks; #0/#1 metadata upgrade without remint | Demonstrated; owners/agent records preserved during upgrade |
| Live collection, mint availability, token-specific agent artwork | Deployed; live collection confirmed, individual screens may be affected by RPC/image availability |
| Private holder watchlists and repeated observations | Demonstrated in production; two blocks shown in the AI report |
| Exact balance comparison | Demonstrated: zero change across approximately 16 minutes |
| Genuine NEAR AI inference | Demonstrated; provider reported 1,021 total input/output tokens for the shown response |
| Agent #1 publication and on-chain task-history match | Demonstrated with the linked transaction; independently checked |
| New mint after the artwork upgrade | **Not separately verified**; do not claim a new post-upgrade mint test passed |
| Transfer after the upgrade | **Not separately demonstrated**; do not claim end-to-end transfer testing |
| Low-balance warning | Implemented/local mock-tested; production threshold-crossing test not demonstrated |
| Read-only account/transaction investigation | Implemented; live read-only and mocked backend checks passed during preparation |
| Expanded liquidity and full agentic-economy UI | Deployed; owner reviewed the updated presentation |
| Ecosystem TVL, trading and revenue integration | Public API and local Next route/cache tests passed; external availability and coverage can change |
| Autonomous per-NFT execution | **Not implemented**; publication is operator-triggered |
| Independent AI attestation / truth verification | **Not implemented** |

Operational limits: three watches per holder / thirty globally; collector handles at most three due watches per tick. AI is holder-triggered with consent, bounded input, maximum output of 700 tokens for observation explanations or 1,200 for mission explanations, caching, no automatic retries, one new attempt/minute and ten/day per holder, ten/day globally and forty total demo attempts. Failed attempts count. These are application request limits, not a dollar cap on other uses of the API key. Credits, RPC availability and free-tier CPU limits can interrupt service.

Model source-ID validation prevents fabricated reference IDs, **not all hallucinations**. Explanations remain unverified hypotheses. Saved reports can be stale. Private observations and AI reports are not automatically on-chain; only explicitly published report packets receive commitments. D1 audit/quota records remain after a watch is removed, although they are hidden from the watch-linked UI.

Artwork uses content-hashed Vercel URLs; hashes detect byte changes but do not guarantee permanent hosting. Administrators can append artwork and upgrade contract code. Snapshot history retains only the newest configured entries (currently 50); transaction receipts remain separate evidence when a commitment is pruned.

**Branding:** the website is Sentinel Buddies. The deployed NFT metadata titles may still say **Sentinel Body**, and repository/package/domain names retain their original identifiers. Those technical names were not blindly renamed. Older exposed testnet credentials were replaced by the fresh deployment named above; never use retired `sentinel-body.testnet` / `sentinel-owner.testnet` keys or accounts for this submission.

## Source map

| Path | Inspect for |
|---|---|
| `contracts/sentinel-body/src/lib.rs` | Provisioning, ownership, restricted keys and publication checks |
| `contracts/sentinel-body/src/artwork.rs` | Append-only artwork registry, existing-token assignment, mint coverage |
| `hosting/cloudflare/platform.ts` | Holder authentication and on-chain access checks |
| `hosting/cloudflare/investigate.ts` | Read-only account/transaction checks and exact arithmetic |
| `apps/web/components/account-investigator.tsx` | Guided investigation and Vault introduction |
| `hosting/cloudflare/watchlist.ts` | Collector, exact arithmetic, source provenance and warning status |
| `hosting/cloudflare/ai-analysis.ts` | Model prompt, consent, quotas, cache and output/reference validation |
| `hosting/cloudflare/agent-reports.ts` | Token-specific task authorization, packet hash and publication history |
| `scripts/publish-agent-report.mjs` | Read-only preflight, explicit signing approval and final receipt checks |
| `scripts/check-submission-evidence.mjs` | Public judge verification without secrets |
| `apps/web/app/collection-state/route.ts` | Finalized collection-state read |
| `apps/web/app/ecosystem-metrics/route.ts` | Public provider fetches, per-source failure states and caching |
| `apps/web/lib/ecosystem-data.ts` | Provider validation, missing-value handling and DEX-only classification |
| `apps/web/components/liquidity-map.tsx` | Expanded balance map, sampled accounts and explanations |
| `apps/web/components/ecosystem-pulse.tsx` | TVL, trading/revenue cards, history and source details |
| `apps/web/components/agent-economy-summary.tsx`, `indices.tsx` | Added summaries plus original full health/cost components |
| `apps/web/components/dashboard.tsx` | Separate ecosystem and agentic-economy sections |
| `apps/web/components/ai-explanation.tsx`, `agent-report.tsx` | Facts/AI separation and task-history UI |

MIT license. No investment returns, staking rewards or autonomous trading are promised. See [Judge and operator guide](docs/JUDGE-GUIDE.md) for the shortest review path, failure handling and publication instructions.
