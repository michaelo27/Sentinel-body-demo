# Verify the evidence

Everything on this page works **without a wallet, AI credits or credentials**. Requirements: Node **20.19 or newer**, internet access and a repository checkout.

> **Name note:** when checking on-chain metadata you may see the title **"Sentinel Body"** rather than "Sentinel Buddies". The project was renamed after the contracts were deployed, so this is expected and refers to the same project. See the notice at the top of the [README](../README.md).

## Fastest check

```bash
node scripts/check-submission-evidence.mjs
node scripts/check-chain-evidence.mjs
```

- **`check-submission-evidence.mjs`** checks the collection, the agent mapping, the restricted access key and the documented publication (signer and hash).
- **`check-chain-evidence.mjs`** fetches the deployed public chain-evidence packet and checks its checksum, pinned references, integer balance arithmetic and retained-publication counts.

Neither script signs transactions, reads private keys or calls AI. Both passed against the deployed endpoints during the latest documentation update. That is a point-in-time result, not a guarantee of continuous availability.

Optional extras:

```bash
# Download and verify the artwork image bytes
node scripts/check-submission-evidence.mjs --media

# Reread the sources behind a packet you saved from the fleet evidence card
node scripts/check-chain-evidence.mjs --packet ./sentinel-chain-evidence.json --reread

# Verify a report packet you deliberately hold (runs locally, uploads nothing)
node scripts/check-submission-evidence.mjs --packet ./buddy-report-3e62906f-f29a-472f-87d1-e5ef1da05b34.json
```

Old state may be pruned or rate-limited. The script reports unavailable rereads separately from matches and never treats missing data as verification. A matching checksum proves byte integrity, not independent attestation of an RPC provider or correctness of a model conclusion.

## No-wallet walkthrough (about 3 minutes)

| Step | Expected result |
|---|---|
| 1. Open [Collection](https://sentinel-body.vercel.app/collection) | Six registered artworks, minted/unminted labels, owners for existing NFTs, pause and availability status and a finalized block number. The count can change, so use the live reading |
| 2. Open [NFT #1](https://sentinel-body.vercel.app/agent/1) | Arctic artwork from NFT metadata and the linked account `agent-1.sntl-02e90eacb8.testnet` |
| 3. Open the [agent #1 transaction](https://testnet.nearblocks.io/txns/EPrjhgDpKxA6s2PZwm9QvuiacqtRXYx1uyshv9ahN1zL) | A successful transaction signed by **agent #1**, calling `publish_snapshot` on the NFT contract |
| 4. Run `node scripts/check-submission-evidence.mjs` | PASS checks for distinct artwork hashes, NFT #1 metadata and mapping, restricted agent permissions and the publication's signer/hash |
| 5. Open [Mint](https://sentinel-body.vercel.app/mint) without clicking mint | Remaining registered IDs, the next artwork and a live availability panel. Connecting a wallet alone does not mint |

**Expected seed state at the last verification:** 6 artwork entries. Existing IDs #0 Original and #1 Arctic. Next ID #2 Ember, minting unpaused. #3 Jade, #4 Royal and #5 Solar registered for subsequent IDs. Four IDs remained, and availability is not reserved for reviewers. Artwork can be appended, so six is not a lifetime cap.

**Public JSON endpoints:** [chain evidence](https://sentinel-body.vercel.app/chain-evidence) · [ecosystem provider metrics](https://sentinel-body.vercel.app/ecosystem-metrics). They hold public chain and provider data only, never private watches or AI case contents. Check each source's status and timestamp, not just HTTP 200.

## Public evidence you can check independently

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

The demonstrated report used observations at blocks **277650217** and **277648579**. Both recorded **6.8894279455544266 NEAR**. Code calculated **0 NEAR** net change across **960181575856 ns** (about 16 minutes). The AI correctly treated the cause as unknown, because unchanged balances do not establish the absence of transactions.

The private report body is **not public by default**. The public checker verifies the commitment and receipt, not the unseen body.

## Retired accounts

`sentinel-body.testnet` and `sentinel-owner.testnet` are **retired**. Their older exposed testnet credentials were replaced by the fresh deployment above. Never use them for verification.
