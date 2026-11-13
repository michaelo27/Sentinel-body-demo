# Methodology — actual implementation and known mismatches

This document describes the code as shipped, not an idealized analytics specification. Existing snapshots and config files are preserved; rewriting them would invalidate historical evidence. No source checks were refreshed for M03.

## Networks, time and sources
Observation defaults to mainnet; fleet ownership and settlement are testnet. Source evidence is historical (see config/sources.json and docs/SOURCES.md), not a guarantee of availability today. Source failures may trigger stale/fallback data. Runtime public delay defaults to 15 minutes, not the 360-minute value described as a production default in older config/comments. Demonstrations previously used two minutes. Use actual environment and snapshot timestamps.

## Snapshot commitment
`hashable()` removes ONLY top-level proof and commitment. The rest of the supplied object is canonicalized (sorted object keys, ECMAScript JSON number/string encoding, no whitespace), encoded as UTF-8, then SHA-256 hashed to lowercase hex. Non-finite numbers and bigint values are rejected. Use only the snapshot object, not delivery/API wrappers: arbitrary gateway-added fields are NOT automatically removed. This is a project stable serializer with JCS-compatible intent, not an independently certified general-purpose RFC 8785 implementation.

Hash match proves the same body was committed. It does not prove correct source observations, honest timestamps, sound economics, complete coverage or availability of all inputs. The on-chain hash and full off-chain JSON must both remain accessible for independent verification.

## Capital Flow Map
Implementation: packages/core/src/indices.ts::capitalFlow.
- Cohort net delta = current balance minus stored reference balance, aggregated by cohort.
- Native NEAR and wNEAR are combined as NEAR-equivalent amounts; USDC is treated as USD 1. Conversion uses the current/end-of-window NEAR price.
- With a previous snapshot, the reference is that snapshot; otherwise native NEAR may use a pinned historical balance.
- The synthetic external/rest node balances the displayed net changes. These are NOT reconstructed gross transfers, counterparties or causal flows.

**Known limitations:** output labels say 24h for a previous snapshot and 12h for a pin, but actual elapsed time/pin age is not guaranteed by those labels. Previous rounds can be minutes apart. Missing baseline values may fall back to current values, creating zero change rather than evidence of zero activity. FT baseline fallback differs from native NEAR pinning. Large raw balances are converted to JavaScript Number, so sub-unit precision can be lost. Accounts/cohorts must be checked for overlap before interpreting totals. Verify actual reference timestamps and query status; do not advertise this as a validated 24h flow index.

## Builder cost model
Implementation: packages/core/src/cost-model.ts.
- Actions/month = agents × transactions/agent/day × 30 × utilization.
- NEAR/action = average Tgas × 10^12 × gas-price-yocto / 10^24.
- Gas USD/month = actions/month × NEAR/action × NEAR USD price.
- Storage locked NEAR = persistent MB × 10^6 × storage-byte-cost-yocto / 10^24. Locked capital is shown separately, not monthly spend.
- Inference USD/month = tokens/day × 30 / 10^6 × (input split × input rate + output split × output rate).
- NEAR monthly spend = gas + inference + infrastructure.
- Cost per 1,000 actions divides monthly spend by actions/month / 1,000.

Gas/action, utilization, inference split, infrastructure and workload are scenario assumptions. RPC gas price and token prices are measurements at retrieval time. Missing model pricing can fall back to the first model or zero; inspect selected model and source status before trusting a low estimate.

**Comparisons are not apples-to-apples:** Base/Ethereum columns omit inference and use assumed gas units; Solana includes account rent in its displayed monthly figure, whereas NEAR storage is separate locked capital. Solana base fee is measured via getFeeForMessage in the implementation, despite older methodology config describing an assumption. Do not use these columns as a verified chain-price ranking.

## Health index: fleet proxy, not ecosystem census
Implementation: packages/core/src/indices.ts::agentHealth. Components are clipped normalized values × weight, summed on a 0–100 scale.

| Component | Implemented bounds | Weight | Actual input |
|---|---|---|---|
| Activity | 0 to 25 | .20 | Fleet publishers matched from selected last two commitment records |
| Growth | -.25 to .25 | .15 | Fleet count change vs previous snapshot |
| Capital | -.30 to .30 | .20 | Fleet balance change vs previous snapshot |
| Concentration | 0 to 1 | .15 | 1 minus balance HHI |
| Retention | 0 to 1 | .15 | Active / fleet count |
| Fleet liveness | 0 to 1 | .15 | Same active / fleet count proxy |

The code uses slice(-2) on the supplied commitment array: array ordering must be checked before calling them the newest two rounds. Retention is NOT measured overlap between two independent activity windows. Growth is NOT an implemented seven-day baseline. Known/heuristic cohorts are empty/disabled. The config's activity upper bound of 1000 differs from code's 25; code controls results.

Coverage = 0.6 if fleet exists + 0.2 if commits exist + 0.2 if previous fleet exists, clipped to [0,1]. Confidence equals coverage multiplied by 0.6 if stale, else 1. These are evidence-availability heuristics, not statistical confidence intervals or configured cohort coverage fractions.

**Interpretation:** not a price signal, investment metric, agent identity ground truth or census. M03 exposes discrepancies; it does not silently change historical formulas. A corrected methodology needs a new version, implementation tests and newly committed snapshots, not relabeling old v1 data.
