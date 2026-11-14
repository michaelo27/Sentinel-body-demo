# Intelligence tools

The shared sections of the Vault. Everything here is public data or saved readings. None of it is output from a holder's AI run.

## 1. NEAR Ecosystem Liquidity Intelligence

**Where did the sampled balances move?** The tool prefers fresh block-pinned native NEAR comparisons, with an explicitly labelled archived fallback. It shows a full-width balance-change diagram, a category/account table, a plain-English takeaway and expandable explanations of what to check next.

| Category | Accounts sampled | What the reading covers |
|---|---|---|
| Intents / solver hub | `intents.near` | Native NEAR change in that hub account, not total swap volume or solver revenue |
| Liquid staking | `linear-protocol.near`, `meta-pool.near` | Selected contract balances, not all staking pools or all staked NEAR |
| DeFi venues | `v2.ref-finance.near`, `dclv2.ref-labs.near`, `contract.main.burrow.near` | Selected trading/lending contract accounts, not total deposits or volume |
| Bridge / Aurora | `aurora` | One selected account, not all bridge assets or flows |
| wNEAR reserve | `wrap.near` | The wrapped-NEAR contract's native balance, used as a reserve-account reading |

**How to read it**

- Later balance minus earlier balance equals the change. Green is an increase, rose/pink a decrease, and wider bands mean larger native-NEAR changes.
- Connecting bands group readings visually. **They are not traced transfers between projects.** Zero net change does not mean zero transactions.
- The headline totals the sample only when every selected account pair is available.
- The fresh method (AUD01) uses two pinned block hashes exactly 1,200 heights apart and shows the actual elapsed time. Its optional dollar figure uses a separately dated provider price, not a guaranteed block-time price.
- The archived fallback uses the original saved conversion and an intended window of roughly 12 hours. It is labelled historical and is not independently reread.
- A decrease is not automatically a loss, a sale, a hack or capital leaving NEAR.

## 2. Ecosystem Pulse: value held, traded and earned

A separate card retrieves public **DefiLlama** data through the frontend server's `/ecosystem-metrics` route. It is independent of the saved account comparison.

| Metric | Meaning | Boundary |
|---|---|---|
| Overall NEAR DeFi TVL | Dollar value locked in protocols covered by the provider's NEAR view | Not NEAR's market cap or every asset on the network |
| Tracked DEX volume, 24h | Sum of available 24-hour values for entries classified as `Dexs`, with reporting coverage shown | Excludes intents/bridge categories. Missing values are not counted as zero |
| Broader trading volume, 24h | The provider's broader trading total | Can include NEAR Intents, bridges and other categories, so it is not pure DEX volume |
| Covered revenue, 24h | The provider's NEAR revenue aggregate under its definitions | Not trader profit, NFT-holder income or every business's revenue |
| Liquidity direction | Daily TVL history, daily change and a prior-week comparison when available | A change in dollar value, **not measured net capital inflow or outflow** |

- The card also shows DEX 24-hour and 7-day breakdowns, broader trading and revenue entries, source links, retrieval time and chart dates.
- Protocol rows can overlap or use different cutoffs. Do not sum them to recreate aggregate totals.
- The 24-hour summary and the latest daily chart date may cover different periods.
- The route caches for up to five minutes. An unavailable source stays unavailable and is never replaced with invented figures. A new retrieval time does not guarantee a new provider observation.
- No net bridge flow or complete ecosystem transfer graph is claimed.

**Source endpoints**

- TVL: `https://api.llama.fi/v2/historicalChainTvl/Near`
- Trading: `https://api.llama.fi/overview/dexs/Near?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true`
- Revenue: `https://api.llama.fi/overview/fees/Near?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyRevenue`

Inspect the live JSON at [`/ecosystem-metrics`](https://sentinel-body.vercel.app/ecosystem-metrics). Check each source's `status`, `fetched_at`, source URL and record dates. A successful HTTP response can still contain an unavailable individual source.

## 3. Agentic Economy Intel

A separate section, not another name for ecosystem liquidity. The newer summary cards supplement the original detailed tools and do not replace them.

| Part | What you can inspect |
|---|---|
| Current direct-chain fleet evidence | Up to 20 minted NFTs, their agent mappings and native balances, up to 50 retained report commitments and the subset timestamped within 24 hours of the source block, all read at one finalized testnet block |
| Agent activity at a glance | Historical sampled-agent counts and the labelled custom model score |
| Saved running-budget example | A quick monthly estimate from a saved scenario. It stays fixed when you change calculator settings |
| Full historical health model | Original gauge and signal breakdowns, with completeness weights, missing-baseline defaults and duplicated proxies explained |
| Interactive running-cost calculator | Workload sliders, model selection, network fees, AI usage, hosting, storage, cost per 1,000 actions and cross-chain comparisons |
| Calculation details | Saved rates, inputs, formulas and available provenance |

**The health gauge is a custom weighted model.** It is not a security audit, an uptime guarantee, an official NEAR rating or a score for every AI agent on NEAR. Missing baselines previously produced neutral scores, and its confidence/coverage fields are developer-chosen weights, not statistical probabilities.

**Running costs are budget estimates, not charges.**

- Network fees, AI usage and hosting make up the monthly plan. NEAR reserved for storage is separate from a monthly subscription cost.
- Changing sliders never moves funds or triggers paid inference.
- Cross-chain comparisons include the same AI and hosting plan and exclude storage/rent reserves from recurring totals. They omit some execution-specific fees and do not establish a universal cheapest chain.

Official BigQuery and Intents documentation was reviewed, but neither is an active integration. BigQuery queries can cost money, and the Intents Explorer needs a partner JWT.

## Vocabulary

| Term | Meaning |
|---|---|
| **Agent account** | The NEAR account linked to a particular NFT. The AI model itself runs off-chain |
| **Snapshot / saved report** | Readings captured at a recorded point in time, not automatically current |
| **Cohort / sample** | A selected group of accounts, not the entire sector |
| **TVL** | Total value locked in the protocols the data provider includes |
| **Volume** | Value traded during a stated period, not value remaining in accounts |
| **Revenue** | The share counted as revenue under the source's methodology, not all fees or profit |
| **Commitment / fingerprint** | A hash recorded on-chain to identify a report's exact bytes |
