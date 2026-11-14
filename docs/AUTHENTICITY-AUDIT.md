# Vault evidence audit and reproduction guide — AUD01

## Verdict

The Vault combines real source readings, third-party aggregates, developer-defined calculations and AI text. It is not honest to call all four independently verified intelligence. This audit makes the categories explicit and corrects weak provenance and comparison labels. It is a source/code review with selected live checks, not a formal external security audit or a guarantee of hackathon eligibility.

| Area | Evidence status | What it does not prove |
|---|---|---|
| Collection ownership and NFT-agent mapping | Public testnet contract reads; submission checker and current pinned fleet endpoint | Future ownership, independent key custody, or autonomous execution |
| Account/transaction investigator | Finalized RPC evidence; account/key/time pinned together; exact integer amounts/fees | Complete token portfolios, motives, identity of key holders, complete transaction history |
| Holder monitoring | Saved RPC observations with block provenance; deterministic integer comparison | Cause of change; identical balances do not prove no transactions |
| Original saved ecosystem snapshot | Local canonical hash, saved proof hash and live contract commitment matched during audit | Authenticity/truth of every original source response; original later account reads did not retain their own exact returned block refs |
| AUD01 liquidity sampling | Native account amounts pinned to two actual block hashes; exact integer subtraction; raw RPC responses retained | Protocol TVL, transfers between cohorts, gross flows, entire ecosystem flows |
| Ecosystem Pulse | DefiLlama mainnet view and linked adapter methods, dates and coverage | Independent audit of every adapter or complete economic coverage |
| Original agent-health gauge | Reproducible custom model; historical value preserved and explicitly labelled | Statistical confidence, official NEAR health, complete agent census, continuous uptime |
| AUD01 fleet evidence | NFT list, agent mappings, balances and retained commitments read at one finalized testnet block | All historical reports if pruned, AI execution from publishing alone, activity of agents outside this collection |
| Running-cost calculator | Deterministic workload model using historical inputs; revised recurring-cost inclusion | Actual billing, fresh market pricing, measured equivalent performance across chains |
| Mission cases and AI | Real read-only source collection plus consented model synthesis; source IDs validated | Automatic truth verification, full balance reconciliation, independent TEE attestation |
| Published hashes | Report-byte integrity and agent attribution when a matching commitment is read | Truth of report conclusions or completeness of the input evidence |

## Concrete issues found and corrected

### 1. Historical balance provenance was overstated

The legacy collector requested current account amounts using `finality: final` separately, while the card implied every later amount came from one common recorded block. Stored query digests were short identifiers, not full independently verifiable source receipts. A historical state window can also be pruned by an RPC. The current raw snapshot is preserved; it must not be rewritten under the old hash.

AUD01 introduces `/chain-evidence`. The mainnet sampler obtains a finalized block and an earlier block exactly 1,200 heights before it. It uses both returned hashes for every account query and rejects inconsistent block references. Actual elapsed time is calculated from nanosecond timestamps; it is not labelled 12h. Amounts stay integer yoctoNEAR strings until after subtraction; exact delta strings and raw RPC responses are exported. UI values are rounded for readability.

Incomplete account pairs are unavailable, not zero. If a category is incomplete, its delta is unavailable; if any account pair is missing, the complete-sample total is unavailable. A missing dollar price does not hide available NEAR deltas. The separately dated CoinGecko price is not claimed to be a block-time valuation. Wide bands represent native NEAR change magnitudes, not transfer routes. At five-minute cache expiry a fresh pair can be retrieved; the interval rolls with the chain, so it is not the same historical comparison as the archived map.

If fresh paired reads fail, the UI can still show the old map explicitly marked archived/not independently reread, rather than silently presenting it as freshly verified. No full archival history or all-token accounting is claimed.

### 2. Agent health had modelling defaults disguised as measured signals

The old score normalizes active publishers against a fixed bound of 25, not the 1,000 described in an outdated config. Its growth and capital inputs defaulted to raw zero when no previous fleet existed; normalization turned those defaults into 50/100. This is not observed stable growth. Retention and liveness share one publisher-share proxy; retention is not measured returning-user behaviour.

The 60% completeness value adds developer-selected weights for evidence categories. It is not a statistical probability or ecosystem coverage percentage. The UI and methodology now disclose the exact weights, defaults and duplicate proxy. The gauge remains, labelled a historical custom model, so original intelligence is preserved without falsely upgrading it to a chain fact.

A separate current fleet evidence card shows the underlying facts: up to 20 NFTs, their agent accounts and balances, retained publications and the subset timestamped in the last 24 hours relative to the source block. The contract retains at most 50 commitments. Zero retained entries does not establish no older publications. Everything is read at one finalized block.

### 3. Cross-chain cost inclusion was inconsistent

Old NEAR comparison rows included AI cost, but EVM/Solana rows did not; Solana also added a rent reserve into a monthly number. AUD01 recalculated rows include the same AI and hosting plan for every chain and exclude rent/storage reserves from recurring totals. Cost per 1,000 actions uses the actual model action count including utilization.

This still is not an execution benchmark: EVM gas units and Solana signatures are workload inputs; Base L1 data fees, priority fees and contract-specific execution are not fully modelled. Historical prices/rates remain labelled historical. Until a new quote succeeds, the UI warns that it is showing the saved default example, not changed slider settings. Historical saved comparison bytes remain unchanged and are not represented as the corrected quote.

### 4. AI overstatement remains possible

A completed production mission explanation overstated what the evidence showed about fund recipients and broader history. Updated instructions now explicitly require “not necessarily recipients” and “broader history not inspected,” rather than negative factual claims. They also prohibit claiming a reconciled signer balance debit from burnt-fee totals alone.

This prompt correction does not prove every future statement will be right. Old saved AI responses are not rewritten. No paid regeneration was triggered. The source notebook and deterministic facts remain the evidence to inspect.

### 5. Methodology and proof labels needed alignment

The public methodology config now describes the actual legacy scoring bounds and missing-baseline defaults, the revised recurring-cost convention and the new sampler. The old proof-panel contract-name caption was corrected to the actual fresh deployment. Snapshot bytes and existing hashes were not changed.

## Independent checks judges can run

Requires Node >=20.19, internet and a repository checkout. No secrets, wallet, AI credit or package installation is required for these scripts.

```powershell
node scripts/check-submission-evidence.mjs
node scripts/check-chain-evidence.mjs
```

The second script requires AUD01 to be deployed. It checks the new endpoint's checksum, retained raw account responses, pinned block references, exact balance deltas, complete-sample total and fleet publication counts. A checksum is self-consistency, not third-party attestation.

For a stronger check, download the raw evidence packet in the fleet card, then replay the pinned RPC queries:

```powershell
node scripts/check-chain-evidence.mjs --packet "C:\path\to\sentinel-chain-evidence.json" --reread
```

Rereads use fixed read-only RPC hosts/methods. A pruned/rate-limited historical state is reported as unavailable, not a successful match. The checker skips re-running a moving `finality: final` block request and instead replays the actual stored pinned calls. The packet retains the original finalized headers. It does not validate economic adapters or attest an RPC provider's honesty.

During this audit, the original saved ecosystem snapshot matched all three hashes:

```text
snapshot: snap-1794592774-60af8391549c
canonical/local = saved proof = live contract commitment
c119694cf636474fd55aee9d94cad9d7158a4a704253f645d1b0295c11c0120a
```

The fresh sampling test returned all eight account pairs and both current minted agents. A subsequent source reread matched 24 pinned RPC responses, with zero unavailable at that test. This is point-in-time verification, not a promise that an RPC will serve those historical states forever.

## Official resources supplied by the user

These were checked as documentation, not silently added as numeric data feeds:

- **Hackathon rules:** https://nearhackathon.com/HACKATHON.md — asks for reproducibility and feature-verification steps; the Investment Thesis track emphasises evidence and rerunnable models. Q-017 says automated screening informs human judging; a low AI score alone does not reject a project. Q-011 says hinted integrations are not mandatory. We cannot guarantee qualification or scores.
- **NEAR data infrastructure:** https://docs.near.org/data-infrastructure/what-is — distinguishes APIs, analytical datasets and block streams. Existing RPC and indexer usage is consistent with those categories; that is not official endorsement of this app.
- **BigQuery:** https://docs.near.org/data-infrastructure/big-query — `bigquery-public-data.crypto_near_mainnet_us` is an optional independent historical source. The docs warn that the old NEAR Lake ingestion source was retired and direct readers to check current ingestion. Public dataset storage does not make every query free. No GCP project, paid query or BigQuery integration was created here.
- **Intents Explorer:** https://docs.near-intents.org/integration/distribution-channels/1click-api/explorer/introduction — read-only 1Click swap history; requires a partner JWT and documents a one-request-per-five-seconds partner limit. It is not all NEAR activity. No token was requested or fabricated, and the current dashboard does not claim to use this API.
- **Documentation indexes:** https://docs.near.org/llms.txt and https://docs.near-intents.org/llms.txt are documentation-discovery resources, not observations to cite as proof of a balance or volume.
- **Agent skills repository:** https://github.com/near/agent-skills is implementation guidance, not a registry or measurement of economic agent activity. No blanket adoption or data integration is claimed.

Optional BigQuery research should first inspect table schemas and latest available dates, use partition filters, preview scanned bytes, and obtain approval for any billable query. A source being official does not remove scope, freshness or verification requirements.

## What remains unverified or limited

- No formal external audit, guaranteed admission, score or investment conclusion.
- No official all-NEAR agent census; testnet Sentinel fleet is deliberately bounded.
- No complete ecosystem transfer-flow reconciliation or full native/token portfolio ledger.
- No independent reproduction of every DefiLlama adapter's aggregate from raw chain events.
- No independent model attestation or guarantee that every AI claim is correct.
- Historical original source values cannot all be re-observed from the metadata preserved in the old snapshot.
- New endpoints require deployment and browser/provider availability checks. Public routes use five-minute warm-instance/CDN caching, bounded source reads and no credentials; public-provider/free-hosting capacity is not guaranteed under heavy traffic.

## Tests and safe deployment

Next production build and TypeScript passed. Unit checks covered exact one-yocto formatting, missing-pair != zero, rejection of mismatched block refs, native values retained without price, consistent inference-cost inclusion and rent exclusion. Existing core tests (14), mission, AI and report-publication regression suites passed. No model call, signing, SQL change or chain publication was made during this audit.

Apply AUD01 incrementally after QUOTA01, deploy the updated Worker while preserving all settings, then push only COMMIT-PATHS.txt files and wait for Vercel Ready. There are no new secrets or database migrations. No existing intelligence card or integration is removed.
