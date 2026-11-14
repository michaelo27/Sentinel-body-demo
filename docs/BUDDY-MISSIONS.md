# Buddy Investigation Desk — MIS01

## What this adds

Three capabilities, with four mission buttons:

1. **Investigate:** account cases combine finalized account/key checks, a previous saved permission check when available, saved balance observations when watched, and up to five recent indexed activity records. Transaction cases inspect one supplied transaction's finalized execution, actions and burnt fees.
2. **Remember my priorities / what changed:** save up to three existing watches per holder/buddy, a focus and a brief/detailed style. Personal cases compare the latest two saved observations and the latest explicitly reviewed personal case. Review is explicit; opening a case does not silently advance the baseline.
3. **Brief me on NEAR:** collect provider TVL history, DEX-only versus broader trading data and covered revenue, preserving source dates, classification and unavailable sources.

Every mission first collects evidence without calling a model. The holder can inspect readable facts, a tool log, gaps and the full source notebook. A second explicit consent step sends the case to NEAR AI Cloud. Validated AI findings cite source IDs; unresolved questions and next checks are separate. Completed cases can be reopened or exported without another model call.

The UI supplements, not replaces, the existing investigator, watchlist, old AI explanation/publication flow, liquidity dashboard and full agent-health/cost sections.

## Use it

1. Authenticate as a holder in Vault. Open **Give my buddy a mission**.
2. Enter an NFT ID you currently own and choose **Open my buddy's desk**. The server verifies the NFT owner and linked agent account on every mission request.
3. For personal briefings, add watches in the existing monitor, allow genuine observations to be collected, then select them in **My buddy priorities & memory** and save.
4. Choose a mission. For an account, supply network/account. For a transaction, supply network/hash/signer. The optional question guides interpretation; it cannot expand server tool permissions.
5. Choose **Collect evidence — no AI charge**. Inspect the tool log, recorded facts, gaps and sources.
6. To request a model explanation, check consent and choose **Ask my buddy to explain the evidence** once. If a request times out, reopen the case before doing anything else. A pending/failed attempt is retained and never automatically retried.
7. For personal briefings, choose **Mark reviewed** to set the comparison baseline for the next personal briefing.
8. Reopen cases from history or download private case JSON. Do not commit private case exports to a repository.

## Evidence boundaries

- Account permission changes are comparisons of two saved account missions, not continuous monitoring. The first mission establishes a baseline. The comparison is withheld if either snapshot has more than 20 keys or any key has more than 20 allowed methods. Gas-allowance changes alone are excluded from permission-change classification.
- Personal briefings use saved native-balance observations. A preference for permissions does not add background key monitoring. New/no-longer-available watches and missing observations remain explicit.
- NearBlocks is queried at a fixed mainnet/testnet host for at most five recent records. Records can be receipts of the same transaction and may fall outside the watched comparison period. Predecessor is not necessarily signer. Token amounts are deliberately excluded from this sample because JSON numeric values can lose precision. This is not a complete account ledger or a proven explanation of a balance drop. A transaction mission can inspect a supplied hash/signer independently through RPC.
- No token-event decoder or complete net-flow reconciliation is introduced. Attached deposits are not guaranteed amounts ultimately received. Transaction fees are burnt fees across returned outcomes.
- Ecosystem data comes from DefiLlama's NEAR mainnet view, not the user's NFT testnet network. DEX-only and broader trading totals remain distinct. TVL value changes do not prove capital inflows/outflows. Coverage/cutoffs can differ. Individual sources can fail independently.
- Ecosystem cases save a bounded provider TVL history plus the current volume/revenue aggregates. This supports recorded TVL comparisons; it is not a continuously scheduled market-history service or a basis for fabricated volume/revenue trends.
- All model content is unverified synthesis. Source-ID validation catches invalid references, not every false conclusion. The model is instructed to treat questions, account names, methods, indexed records and preferences as untrusted data, not instructions. React renders the response as text, not executable HTML.

## What is and is not agentic

The buddy owns a logical mission workspace linked to its NFT identity. The server executes a fixed, bounded, read-only plan selected by mission type. The model synthesizes gathered evidence. This is useful tool-assisted investigation, **not unrestricted model-chosen tool execution**, autonomous trading or an AI model running on-chain.

No signing keys, wallet signatures or transfers are required for collection or analysis. NFT authentication is still required. No scheduled AI calls are added.

**Case export is not publication:** this new case JSON is not accepted by the existing local AG01 report publisher. The prior watch-observation AI report publication flow stays unchanged. MIS01 does not silently publish cases or claim an on-chain commitment for a local SHA-256 evidence hash. Publication integration for mission cases is a separate future change requiring a reviewed packet schema and publisher validation.

## Privacy and ownership

Profiles and cases are scoped by both authenticated holder and NFT ID. Each endpoint rechecks current ownership and mapping. A transferred NFT's new owner starts with their own empty workspace; they cannot see the previous holder's private cases or preferences. A former owner cannot open that NFT workspace without current ownership, even if they own another buddy. Download before transferring if you want a local copy.

Removing a watch does not erase already saved case content or model-attempt audit rows. This demo retains those records. There is no bulk delete/reset operation and no attempt-counter reset. Public source lookups disclose the inspected account to the RPC/indexer; AI consent sends the case evidence, question and preferences to NEAR AI Cloud.

## Limits and billing

- Four write/collection mission operations per minute per holder; the existing investigator also retains its own five-check/minute limit.
- One new case per holder per 30 seconds; 30 cases per holder and 120 globally. Failed or interrupted collections remain counted. Up to 30 cases per selected buddy are listed.
- AI shares the existing `ai_reports` reservation/quota table: one attempt/minute, ten/day per holder, ten/day globally and 40 lifetime demo attempts across old and new AI tools. MIS01 does not reset history. QUOTA01 raises only the holder daily cap from three to ten with approval; the global daily and lifetime caps stay unchanged.
- At most 20,000 characters of saved evidence per case and 1,200 model output tokens for a mission explanation. Legacy explanations keep their 700-token limit.
- Bounded response streams and fetch timeouts; no automatic paid retries. Partial source failures are visible. A case with zero successful sources cannot call the model.
- Provider-reported token usage is shown when available. Exact dollar cost is not returned by this implementation; use provider billing. Existing $10 credits are not a per-application spending cap. Failed/time-out calls may incur charges.
- Reopening a completed explanation is free of new model inference. Recollecting creates a new case and requires new consent before analysis. No automatic deduplication across distinct collected cases is claimed.
- Free-tier Worker CPU headroom and provider rate limits are not guaranteed by local tests.

## Deployment order — do not skip the SQL

This patch assumes revised ECO01 and DOC02 are installed. Follow the guarded ZIP installer preflight, then apply locally.

1. **D1:** in the existing Worker's bound D1 database console, run `hosting/cloudflare/schema-missions.sql` once. It adds `buddy_profiles`, `buddy_cases` and indexes using `IF NOT EXISTS`. Do not create a new database, drop tables or reset `ai_reports`. Existing `schema-ai.sql` and `schema-watchlist.sql` must already be installed.
2. **Worker:** deploy the updated `hosting/cloudflare/worker.mjs` as the existing Worker. Keep its D1 binding, cron, `JWT_SECRET`, `ALLOWED_ORIGIN`, `NEAR_AI_API_KEY`, `AI_ENABLED` and monitoring settings unchanged. No new secret is required. The exported bundle preserves existing routes.
3. **Website:** stage only the paths listed in the patch's `COMMIT-PATHS.txt`, commit and push. Wait for Vercel Ready. The Worker imports the existing ECO01 ecosystem normalizer at build time; the supplied bundle already includes it.
4. **Smoke test:** authenticate, open buddy #1 if still owned, collect a transaction or account mission without analysis, inspect evidence and reopen it. Then explicitly approve one AI synthesis if desired. Confirm a completed result, usage, source links and cached reopening. Test personal priorities after selecting real watches and collecting observations.

No contract upgrade, mint, SQL reset, new paid hosting service or chain publication is required. If deployment fails, stop and report the exact message; do not rerun chain deployment scripts.

## Validation performed in the workspace

- Next production build and TypeScript passed.
- New tests ran against real workerd/D1 with mocked external RPC/indexer/model: auth, holder revocation, per-token ownership, transfer isolation, preference ownership, exact balance and fee arithmetic, permission baseline/diff/truncation, review baselines, DEX classification, partial source failures, consent, shared old/new AI quotas, invalid source IDs, cached reopening and failure retention all passed.
- Existing investigation, AI and agent-report regression suites passed.
- Live read-only collection passed for `wrap.near`, the documented agent #1 publication transaction, and all three ecosystem sources using temporary local D1. No production holder credentials were used. No model call or transaction was made.
- A first live harness attempt failed because of request forwarding in the test harness; corrected explicit request forwarding succeeded. No application authentication bypass was deployed.
- Real NEAR AI quality/latency for the new mission prompt, production Worker CPU, deployed browser interaction and a complete transfer scenario remain to be confirmed after deployment. Mock-model tests are not presented as live inference evidence.

## Source map

- `hosting/cloudflare/missions.ts`: ownership, plans/tools, profiles/cases, source normalization, exact comparisons, model consent/validation and shared quota reservations.
- `hosting/cloudflare/schema-missions.sql`: additive tables and indexes.
- `hosting/cloudflare/worker-source.ts`: authenticated route wiring; `worker.mjs`: deployable bundle.
- `apps/web/components/buddy-missions.tsx`: mission desk, consent, facts/sources, case history and private download.
- `apps/web/app/vault/page.tsx`: additive Vault integration.
- Existing `apps/web/lib/ecosystem-data.ts`, `investigate.ts`, `ai-analysis.ts` and `watchlist.ts`: reused validation and read-only evidence helpers.
