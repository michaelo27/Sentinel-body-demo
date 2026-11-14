# Architecture

> **Name note:** the product is *Sentinel Buddies*, but the Rust crate, repository, package names and domain still use the original *sentinel-body* identifiers, and on-chain metadata titles may say *Sentinel Body*. The project was renamed after the contracts were deployed. See the notice at the top of the [README](../README.md).

## How evidence becomes intelligence

A balance dashboard shows a number. An AI answer may offer a plausible explanation without evidence. Neither alone tells a holder what was observed, what was calculated or who published the report. Sentinel Buddies separates those responsibilities:

1. **Observe:** a read-only Cloudflare Worker saves NEAR account amounts and exact block references in D1.
2. **Calculate:** code computes net balance change and elapsed block time using integer arithmetic.
3. **Explain:** NEAR AI Cloud receives a bounded evidence packet. Observation explanations use at most two saved readings. Mission cases can include account, transaction, watch or ecosystem sources. AI findings stay separate from recorded facts and calculated values.
4. **Attribute:** the holder prepares a report for a specific NFT they own. Its linked agent publishes the report's canonical SHA-256 hash through a restricted function-call key.
5. **Verify:** execution history checks the on-chain report hash, token ID and publishing agent. Hash agreement establishes byte consistency and attribution, **not AI correctness or the cause of a balance change**.

## System diagram

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

The agent's **defined responsibility is report publication**. Collection and inference are separate off-chain operations.

## Four kinds of evidence

The interface separates these source and calculation categories:

1. **Fresh block-pinned mainnet balance comparisons** and testnet fleet evidence
2. **An explicitly archived fallback** and the historical health model
3. **Third-party mainnet ecosystem aggregates** (DefiLlama)
4. **Cost scenarios** using saved rates

None of these is evidence that a holder's AI just executed. Private watches and AI execution history are kept separate from all of them. What each kind proves and does not prove is in the [README table](../README.md#what-the-evidence-does-and-does-not-prove) and [LIMITATIONS.md](LIMITATIONS.md).

## Trust boundaries

- The restricted worker key may be **shared across agent accounts**. This is not independent key custody per NFT.
- Holder and report authorization is enforced by the application and the local publisher, **not atomically by the publication contract**. Operator trust and ownership-change races therefore remain relevant.
- No agent private key is stored in the hosted Worker. The local publisher reads the restricted key from the operator's private keystore only after explicit approval.
- Administrators can append artwork and upgrade contract code.
- Model attestation is **not independently verified** by this app.
- The older Node runtime under `services/agent` is not the deployed Cloudflare runtime. Older milestone documents describe earlier states.

## Why NEAR, and what each technology does

| Technology | Role |
|---|---|
| **NEAR accounts and subaccounts** | Minting provisions `agent-<token_id>.<contract>` as a dedicated agent identity |
| **NEP-171 NFTs / NEP-177 metadata** | Ownership and registered artwork attach to token IDs, so artwork follows a transfer rather than a wallet |
| **NEAR function-call access keys** | The demonstrated agent has one key restricted to `publish_snapshot` on the NFT contract, with an allowance and no FullAccess permission |
| **Rust / near-sdk contracts** | Record NFT ownership, agent mappings and bounded report commitments. Publication requires a registered agent signer/predecessor |
| **NEP-413 wallet authentication** | Signed challenges establish holder sessions. The hosted receipt shortcut and organizer demo transaction routes are disabled |
| **NEAR AI Cloud** | The deployed text-analysis path uses `Qwen/Qwen3-VL-30B-A3B-Instruct` through an OpenAI-compatible API. Model attestation is not independently verified |
| **NEAR JSON-RPC** | Finalized account observations and read-only checks. The evidence sampler pins all selected amounts to common block hashes and retains raw responses |
| **NearBlocks indexer** | Up to five recent activity records for account missions. A limited lead source, not a complete ledger |
| **DefiLlama public APIs** | Third-party mainnet TVL, trading and revenue data via a separate Next.js server route. No private holder data or AI credentials are sent |
| **Next.js/React + Vercel; Cloudflare Worker/Cron + D1** | UI, private holder APIs, off-chain collection, AI orchestration and execution records |

## Where things run

| Question | Answer |
|---|---|
| Where do minting and report publication run? | NEAR **testnet** |
| Which networks can be investigated? | Mainnet and testnet |
| Which network do ecosystem metrics describe? | NEAR **mainnet** |
| Where does AI run? | Off-chain, through NEAR AI Cloud, when an authenticated holder requests it |
| What is recorded on-chain? | NFT ownership, agent mapping and explicitly published report commitments. Private report bodies are not published automatically |
| Is the agent autonomous? | No. Publication needs an operator's local restricted key and explicit approval |
