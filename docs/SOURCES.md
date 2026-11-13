# SOURCES.md — verified external dependencies

**Checked:** 2026-11-12 (Africa/Lagos; UTC 21:37) · **Hackathon deadline:** 14 Nov 2026
**Evidence:** `config/sources.json` — 96 real requests, **86 live, 10 expected-degraded, 0 unexpected failures**.
Regenerate with `pnpm sources:check` (`python3 scripts/verify-sources.py`). No entry below was written from memory: every URL, method, parameter shape and field name was observed in a real response. The verifier records HTTP status, `chain_id`, heights, response keys, headers and elapsed time for each check.

> Anti-hallucination rule: code MUST NOT reference an endpoint, field, account ID, price or version that is not in `config/sources.json`. If a source is down at demo time, the product serves the last real snapshot with a **Stale** badge, never a fabricated number.

---

## 0. Findings that changed the design (read this first)

| # | What we assumed | What the live request actually returned | Decision |
|---|---|---|---|
| 1 | `https://rpc.testnet.near.org` and `https://rpc.mainnet.near.org` are primary RPCs | As of **2026-11-12**, every JSON-RPC POST returns **HTTP 429** with `"WARNING! THIS ENDPOINT IS DEPRECATED! STOP USING IT NOW! Switch to https://fastnear.com or alternative RPC providers at https://docs.near.org/api/rpc/providers"`. `GET /status` intermittently still answers 200. | **FastNEAR is now PRIMARY** for both networks. Foundation nodes are kept as last-resort fallbacks and are health-checked so their deprecated status is visible in `/api/health`. Exact 429 body is in `config/sources.json`. |
| 2 | NearBlocks `/v1/txns` | Testnet v1 returns **410**: `"API v1 was retired on 2026-11-05. Use /v3; see /api-docs/migration."` Mainnet v1 still responded 200 during the check, but the official migration guide says **v1/v2 switch off on 22 November 2026**; v3 responses are under `data`/`meta`, not `txns`/`cursor`. | Build against **`/v3` only**, on both `api.nearblocks.io` and `api-testnet.nearblocks.io`. |
| 3 | `protocol_config` RPC method | `METHOD_NOT_FOUND`. The real method is **`EXPERIMENTAL_protocol_config`** with `{"finality":"final"}`. | Use `EXPERIMENTAL_protocol_config`. Also `validators` requires params `[null]`; `{"finality":"final"}` is a `PARSE_ERROR`. |
| 4 | 24 h balance deltas via `view_account(block_id)` | FastNEAR serves pinned state back to **86,400 blocks** (≈12 h at the observed 0.566 s/block). `-100000` returns `GARBAGE_COLLECTED_BLOCK`. The deprecated Foundation node served ≈180,000 blocks but is being switched off. | **Capital Flow Tier 1 uses the brief's documented snapshot-diff fallback** (diff the agent's own previous real snapshot). Pinned-block deltas are used opportunistically for the ≤12 h window and labelled as such. No archival/paid node required. |
| 5 | NEAR USDC contract `…33a1.near` | `PARSE_ERROR: the Account ID is too long`. Circle's published address is the **bare 64-hex implicit account with no `.near` suffix**: `17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1`. That account resolves, and `ft_metadata` returns `{"spec":"ft-1.0.0","name":"USDC","symbol":"USDC","decimals":6}`. | Use the bare hex ID. No guessed token addresses. |
| 6 | NEAR AI prices need an `assumption` label | `https://cloud-api.near.ai/v1/models` is a **public machine-readable catalog** (64 models, `pricing.input` / `pricing.output` in USD per 1M tokens), and `https://near.ai/pricing` states "Rates are read from the public NEAR AI Cloud catalog API. Last updated 2026-11-12". `https://api.near.ai/v1/models` is **410 Gone** (retired 2025-10-31). | Inference prices are `kind: "published_catalog"`, not assumptions. Gas-units-per-op, utilization and the Solana signature fee remain `kind: "assumption"` and are badged in the UI. |
| 7 | Solana `getFees` | `-32601 Method not found` (removed). `getMinimumBalanceForRentExemption(128)` works → `1300480` lamports. `getFeeForMessage` with a real recent blockhash returns `{"value":5000}` lamports for 1 signature. `solana.com/docs/core/fees` returned 429 to datacenter IPs. | The **5000 lamports/signature base fee is measured on-chain**, not quoted as an assumption. Rent and base fee both come from live RPCs. |
| 8 | `testnet.nearblocks.io/txns/<hash>` | Returns **403 Cloudflare "Just a moment…"** to datacenter IPs (both plain and browser UA). The `/txns/<hash>` path is the site's canonical tx route and works for human browsers. | Kept as the UI link target; `config/sources.json` records the 403 as an **expected degraded** check (transport-blocked, not a broken URL). |
| 9 | `near-testnet.drpc.org` | `GET /status` → 404, but JSON-RPC POST `status` → 200 with `chain_id: "testnet"` and a height matching FastNEAR. | Valid **testnet fallback #2**; health-check via POST, never GET. |
| 10 | Concurrency | 8-way parallel probing produced **HTTP 429** from the public testnet RPC; CoinGecko and NearBlocks also returned 429 under repeated polling. | Runtime uses ≤4 concurrent fetches, per-host caches, and 0.4 s → 1.6 s → 3.2 s exponential backoff. These 429s are real measured rate limits, not guesses. |

---

## 1. NEAR RPC endpoints (ordered fallbacks, `config/rpc.json`)

All JSON-RPC checks POST to `/` with `{"jsonrpc":"2.0","id":...,"method":...,"params":...}`.

| Priority | Network | URL | `GET /status` | JSON-RPC `status` | Notes |
|---|---|---|---|---|---|
| 1 (primary) | testnet | `https://test.rpc.fastnear.com` | 200 | 200 `chain_id: "testnet"` | free, no key, our default |
| 2 | testnet | `https://near-testnet.drpc.org` | 404 | 200 `chain_id: "testnet"` | POST-only |
| 3 (last resort) | testnet | `https://rpc.testnet.near.org` | 200 sometimes | **429 deprecated** | do not depend on |
| 1 (primary) | mainnet | `https://free.rpc.fastnear.com` | 200 | 200 `chain_id: "mainnet"` | free, no key |
| 2 (last resort) | mainnet | `https://rpc.mainnet.near.org` | 200 sometimes | **429 deprecated** | do not depend on |

**Verified response shapes (mainnet primary, block ≈224,270,055):**

| Method | Params | Returns |
|---|---|---|
| `status` | `[]` | `{version{version,build,commit,rustc_version}, chain_id, protocol_version:88, latest_protocol_version:88, sync_info{latest_block_hash,latest_block_height,syncing,...}, validators[], ...}` |
| `gas_price` | `{"finality":"final"}` | `{"gas_price":"100000000"}` — yoctoNEAR per gas unit ⇒ **1 Tgas = 0.0001 NEAR** at the observed price |
| `EXPERIMENTAL_protocol_config` | `{"finality":"final"}` | `runtime_config.storage_amount_per_byte = "10000000000000000000"` (1e19 yocto/byte ⇒ **1 NEAR per 100 KB**, drives mint cost). Also `min_gas_price="1000000000"`, `max_gas_price`, `transaction_costs.*` (`action_receipt_creation_config.send_sir = 108059500000`, `action_creation_config.function_call_cost.send_sir = 200000000000`). **Observed discrepancy:** `min_gas_price` (1e9) ≠ live `gas_price` (1e8); the cost model uses the live `gas_price` RPC, which is what is actually charged, and records both values in the snapshot. |
| `validators` | `[null]` | `{current_validators[342], next_validators[346], current_proposals[263], epoch_height, epoch_start_height, prev_epoch_kickout, ...}` |
| `block` | `{"finality":"final"}` | `{author, chunks[], header{height,hash,timestamp,...}}` |
| `query` `view_account` | `{"request_type":"view_account","account_id":…,"finality":"final"}` | `{amount, block_hash, block_height, code_hash, locked, storage_paid_at, storage_usage}`; amounts are yoctoNEAR strings |
| `query` `view_account` (pinned) | same with `{"block_id":<height>}` | same, at that height. Works to `-86400`; `-100000` → `GARBAGE_COLLECTED_BLOCK` |
| `query` `call_function` | `{"request_type":"call_function","account_id":…,"method_name":…,"args_base64":…,"finality":"final"}` | `{result: [byte array], logs[], block_height, block_hash}` — decode bytes as UTF-8 JSON |
| `query` `view_access_key` | `{"request_type":"view_access_key","account_id":…,"public_key":…,"finality":"final"}` | `{nonce, permission: "FullAccess" \| {FunctionCall:{allowance,receiver_id,method_names[]}}, block_hash, block_height}` |
| `query` `view_access_key_list` | `{"request_type":"view_access_key_list","account_id":…,"finality":"final"}` | `{keys:[{public_key, access_key{nonce,permission}}], block_height, block_hash}`. `wrap.near` has 0 keys; `testnet` has >100 → `TOO_MANY_ACCESS_KEYS` (use paginated NearBlocks v3 or single `view_access_key`) |
| `query` `view_code` | `{"request_type":"view_code","account_id":…,"finality":"final"}` | `{code_base64, hash, block_height, block_hash}` |
| `tx` | `{"tx_hash":…,"sender_account_id":…,"wait_until":"FINAL"}` | `{final_execution_status:"FINAL", transaction{...}, transaction_outcome{...}, receipts_outcome[{outcome{logs:["EVENT_JSON:…"],status,…}}], status{…}}` — used for `attest_holder` fallback and the activity feed |
| `broadcast_tx_commit` | `{"signed_tx_base64":…}` | used by our dependency-free deploy/runtime signer (see `scripts/near-tx.mjs`) |

**Testnet availability check:** `view_account("sentinel-body.testnet")` → `UNKNOWN_ACCOUNT`, i.e. the intended contract name was free when checked. `testnet` resolves with a balance. If you deploy later, re-check name availability — do not assume.

---

## 2. Free data APIs (all HTTP 200 on 2026-11-12 unless noted)

| Endpoint | Exact response shape / example | Rate-limit notes |
|---|---|---|
| `https://api.coingecko.com/api/v3/simple/price?ids=near,ethereum,solana&vs_currencies=usd&include_last_updated_at=true` | `{"near":{"usd":3.44,"last_updated_at":1794519420},"ethereum":{"usd":…},"solana":{"usd":…}}`; `Cache-Control: max-age=30, public, must-revalidate, s-maxage=60` | Free tier; we observed **429** when polled repeatedly. Cache ≥60 s, back off, serve stale with badge. |
| `https://api.coingecko.com/api/v3/ping` | `{"gecko_says":"(V3) To the Moon!"}` | same |
| `https://cloud-api.near.ai/v1/models` | `{"object":"list","data":[{"id","name","owned_by","pricing":{"input":0.04,"output":1.35,"prompt":"0.00004",…},"context_length",…}, … 64 models]}`; `Cache-Control: no-store`; prices are USD / 1M tokens per `https://near.ai/pricing` | Public read, no key. Cache the catalog in the snapshot so it is re-computable. |
| `https://near.ai/pricing` | HTML, "Input and output tokens are priced separately per 1M tokens… Last updated 2026-11-12", model table (`Qwen/Qwen3.8-27B` $0.04 in / $1.35 out, `deepseek-ai/DeepSeek-V4.1-Flash-1017` $0.3 / $1.2, `z-ai/glm-5.3-flash` $0.08 / $0.5, `openai/gpt-5-nano` $0.05 / $0.4) | Human-readable mirror of the catalog |
| `https://near.ai/models` | HTML catalog, 63–64 models with per-1M-token prices | — |
| `https://api.near.ai/v1/models` | **410 Gone** — "NEAR AI Developer Hub and Completions API were retired on October 31, 2025" | DO NOT USE |
| `https://api.fastnear.com/status` | `{"version":"0.10.1","sync_block_height":…,"sync_balance_block_height":…,"sync_latency_sec":…,"sync_block_timestamp_nanosec":"…"}` | free, no key |
| `https://api.fastnear.com/health` | `{"status":"ok"}` | free |
| `https://api.fastnear.com/v1/account/{account_id}/ft` | `{"account_id":"intents.near","tokens":[{"contract_id":"22.contract.portalbridge.near","last_update_block_height":222032481,"balance":"14886233"}, …]}` (≈63 KB) | free, cache aggressively |
| `https://api.fastnear.com/v1/account/{account_id}/full` | `{"account_id","pools":[],"tokens":[...],"nfts":[...],"state":{…}}` (≈86 KB for intents.near) | free, cache |
| `https://api.fastnear.com/v1/ft/{token_id}/top` | `{"token_id":"wrap.near","accounts":[{"account_id":"intents.near","balance":"17214800372263773443329929220159"}, …]}` | free |
| `https://api.fastnear.com/v0/public_key/{public_key}` | `{"public_key":"ed25519:…","account_ids":[]}` | free |
| `https://test.api.fastnear.com/status` | same shape, testnet heights (≈277,419,000) | free |
| `https://mainnet.neardata.xyz/v0/block/{height}` | `{"block":{"author","chunks":[…],"header":{…}}}` — full block with actions, ≈173 KB | free, 302 on `/v0/last_block/final` and `/v0/first_block`; docs root mentions `?apiKey=` (not required for reads). Sample sparsely; Tier-2 only. |
| `https://mainnet.neardata.xyz/v0/block/{height}/headers` | header-only block, ≈20 KB | free |
| `https://api.nearblocks.io/v3/txns?limit=1` | `{"data":[{"transaction_hash","signer_account_id","receiver_account_id","actions":[],"actions_agg":{"deposit","gas_attached"},"block":{"block_hash","block_height","block_timestamp"},"outcomes_agg":{"gas_used","transaction_fee"},…}],"meta":{…}}` | **Strict undocumented limit; no ratelimit headers; we observed 429.** Cache + backoff. |
| `https://api.nearblocks.io/v3/blocks?limit=1` | `{"data":[{"author_account_id","block_hash","block_height","block_timestamp",…}],"meta":{…}}` | same |
| `https://api.nearblocks.io/v3/stats` | `{"data":{"avg_block_time":"0.56600000","change_24h":…,"circulating_supply":…,"gas_price":"100000000","market_cap":…}}` | same |
| `https://api-testnet.nearblocks.io/v3/txns?limit=1` | same v3 shape, testnet | same; **v1 is 410 here** |
| `https://api-testnet.nearblocks.io/v3/accounts/{id}/keys` | `{"data":[{"public_key","permission",…,"created":{…}}]}` | same |
| `https://api.nearblocks.io/api-docs/migration` | Markdown: v3 paths, `data`/`meta`, `limit`/cursor pagination, `/account/`→`/accounts/`, v1/v2 off 22 Nov 2026 | static |
| `https://ethereum-rpc.publicnode.com` `eth_gasPrice` | `{"jsonrpc":"2.0","id":1,"result":"0x…"}` (wei, hex) | free public node; cache 60 s |
| `https://mainnet.base.org` `eth_gasPrice` | same shape | free public node |
| `https://api.mainnet-beta.solana.com` `getMinimumBalanceForRentExemption [128]` | `{"jsonrpc":"2.0","id":1,"result":<lamports>}` | public RPC has aggressive per-IP limits; fallback `https://solana-rpc.publicnode.com` verified with the same method |
| `https://api.mainnet-beta.solana.com` `getFees` | `-32601 Method not found` | removed; do not use |
| `https://helper.nearprotocol.com/account` (POST) | `{"newAccountId":"…testnet","newAccountPublicKey":"ed25519:…"}` → tx outcome with `final_execution_status:"EXECUTED_OPTIMISTIC"`, `receipts_outcome[].outcome.status.SuccessValue` | Free testnet faucet. GET returns 405. Used once by `scripts/create-account.mjs`. |

---

## 3. Verified accounts / contracts (mainnet unless stated)

Every row resolved with a real `view_account` (200 + `amount`, `code_hash`, `storage_usage`) at the checked block. `config/cohorts.json` contains only these IDs.

| Account | Category | Observed `amount` (yoctoNEAR) | Evidence |
|---|---|---|---|
| `intents.near` | intents | `136971879571583972128222992171` | `view_account` 200; FastNEAR `/v1/account/intents.near/ft` returns its real token list |
| `wrap.near` | wNEAR reserve | `36883827359146564749510166666663` | `view_account` + `ft_metadata` → `{"spec":"ft-1.0.0","name":"Wrapped NEAR fungible token","symbol":"wNEAR","decimals":24}`; `ft_balance_of(intents.near)` → `"17214478246880445047400309491336"` |
| `v2.ref-finance.near` | defi | `32621592611579940364399282125` | `view_account` 200 |
| `dclv2.ref-labs.near` | defi | `9682707935395233870138433320` | `view_account` 200 |
| `contract.main.burrow.near` | defi | `11022633142260863927307954794` | `view_account` 200 |
| `linear-protocol.near` | staking | `1090577949341257332198561018882` | `view_account` 200 |
| `meta-pool.near` | staking | `300320343038294524867833476886` | `view_account` 200 |
| `aurora` | bridge | `145768497181409676817125837429` | `view_account` 200 |
| `17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1` | Circle native USDC (bare hex, 6 decimals) | `7301426092270990461886511519` | `view_account` + `ft_metadata` + `ft_balance_of(intents.near)` → `"3088389339564"`. Address from [Circle contract docs](https://developers.circle.com/stablecoins/usdc-contract-addresses) |
| `sentinel-body.testnet` | **our NFT contract (to deploy)** | — | `view_account` on testnet → `UNKNOWN_ACCOUNT` (name available at check time). The deployed address is written to `deployments/testnet.json` by the deploy script; if that file is absent, nothing is claimed as deployed. |
| `faucet.testnet` | testnet control | — | `view_access_key_list` → 2 keys, first is `{nonce:1, permission:"FullAccess"}` — verifies the `view_access_key` shape used by NEP-413 auth |

**Not verified ⇒ not configured:** no "agent registry" mainnet account is claimed. `config/agent-signals.json` has an empty `known` list, a real `fleet` source (our own testnet agents) and a disabled P1 heuristic definition with published thresholds.

---

## 4. Version pins (queried from registries, not remembered)

| Package | Verified latest | Where used |
|---|---|---|
| `near-sdk` | **5.30.1** (crates.io) | both contracts |
| `near-contract-standards` | **5.30.1** (crates.io) | NEP-171/177/181 |
| `near-workspaces` | **0.24.0** (crates.io) | sandbox tests |
| `cargo-near` | **0.23.0** (crates.io + GitHub `cargo-near-v0.23.0`) | build script (optional; plain `cargo build --target wasm32-unknown-unknown --release` also works) |
| `near-cli-rs` | **v0.31.1** (GitHub releases) | optional deploy helper |
| `near-api-js` | **7.5.3** (npm) | web wallet + runtime signing helper |
| `@near-wallet-selector/core`, `/meteor-wallet`, `/modal-ui` | **10.1.4** | Meteor-friendly connect |
| `next` / `react` | **16.4.6** / **19.3.1** | web app |
| `tailwindcss` / `zod` / `fastify` | **4.3.5** / **4.6.7** / **5.12.8** | styling / schemas / gateway |
| `framer-motion` / `sonner` / `lucide-react` / `d3-sankey` / `borsh` | **14.13.0** / **2.0.0** / **1.72.0** / **0.12.3** / **2.0.0** | UI / NEP-413 Borsh payload |

Standards fetched and read as raw spec text: NEP-171, NEP-177, NEP-181, NEP-297, NEP-413 (raw GitHub URLs in `config/sources.json`). NEP-413 digest = `SHA256( u32_le(2^31+413 = 2147484061) ‖ Borsh{message, nonce[32], recipient, callbackUrl?} )`, signed with a full-access key, returned as `{accountId, publicKey, signature(base64), state?}`.

> `near-sdk 5.30.x` requires protocol ≥85 (it imports gas-key host functions). Observed `protocol_version: 88` on both testnet and mainnet, so this pin is safe. Contract sizes and storage math are documented in `contracts/README.md`.

---

## 5. Rate-limit / failure policy derived from these checks

1. Health-check all RPCs at startup with `status` over POST (never GET for dRPC). Report live/dead in `/api/health`.
2. Ordered fallbacks per network (`config/rpc.json`); a 429 or 5xx promotes the next endpoint.
3. ≤4 concurrent outbound fetches, polite `User-Agent: SentinelBody/0.1`, exponential backoff 0.4/1.6/3.2 s.
4. Per-source caches: CoinGecko ≥60 s; protocol config ≥10 min; FastNEAR account data ≥5 min; NearBlocks ≥5 min with the strongest backoff.
5. On failure: serve the **last real snapshot** with `stale: true` and the timestamp of the last successful fetch. `DEMO_REPLAY=1` replays recorded real snapshots with a **Replay** badge. Nothing is synthesized.

---

## 6. Deliberately failing negative controls in `config/sources.json`

These are recorded as `expected_degraded: true` — the error **is** the verified fact:

- `rpc.mainnet.near.org` / `rpc.testnet.near.org` JSON-RPC → 429 deprecation notice (×4 checks).
- `near-testnet.drpc.org` `GET /status` → 404 (POST works).
- `api-testnet.nearblocks.io/v1/txns` → 410, v1 retired.
- `getFees` on Solana → `-32601`.
- `view_account` at `latest-100000` → `GARBAGE_COLLECTED_BLOCK` (defines the archival boundary).
- `view_account("sentinel-body.testnet")` → `UNKNOWN_ACCOUNT` (name availability).
- `testnet.nearblocks.io/txns/<hash>` → 403 Cloudflare challenge from datacenter IP.

---

## 7. Not verified / requires the user

- **Deployed contract addresses, Genesis agent ID, gateway URL and demo URL** — written to `deployments/testnet.json` by `scripts/deploy.sh` only after they really exist. No placeholder addresses are presented as real.
- **Wallet interaction / `signMessage` support in a specific wallet build** — NEP-413 is implemented to the final spec; Meteor's runtime support must be confirmed by connecting a real wallet. `attest_holder(nonce)` transaction fallback is implemented for wallets without `signMessage`.
- **Free container host tiers** — not claimed until checked; local gateway + live preview + recorded video is the documented fallback.
- **NEAR AI catalog API stability** — verified 200 on 2026-11-12; snapshot records the exact model IDs and prices used, so a later price change cannot silently alter a historical number.
