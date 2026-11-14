# Release history

Release codes (UX01, MIS01 and so on) appear in older notes, code comments and some docs. This page explains what each one means.

| Code | Name | What it added | Verification status |
|---|---|---|---|
| **UX01** | Guided investigation | Guided account/transaction investigation and clearer positioning of the NFT-linked AI agent | Live read-only checks and backend regression tests passed |
| **ECO01** (revised) | Ecosystem and agentic-economy sections | Separate liquidity and agentic-economy sections, expanded account map, provider TVL/trading/revenue data. Original health and cost tools retained | Owner reviewed the deployed interface. The ecosystem endpoint returned all three provider sources as available during the latest check |
| **MIS01** | Buddy missions | The Buddy Investigation Desk: evidence collection, AI case explanations, saved priorities, personal briefings and ecosystem briefings | Owner demonstrated a completed transaction mission and a real NEAR AI readout in production. Other mission types have local/mock coverage and live public-source checks. A production AI run for every type is not claimed |
| **QUOTA01** | Quota fix | Holder allowance raised to ten attempts per day. Specific quota and cooldown errors shown beside the AI button | Deployed. The owner's previously blocked mission completed after the fix. Global daily and lifetime caps were not increased or reset |
| **AUD01** | Authenticity audit | Exact block-pinned liquidity evidence, current fleet evidence, downloadable raw responses, honest model labels and corrected budget comparisons | Deployed public endpoint returned available liquidity/fleet data and `check-chain-evidence.mjs` passed. During development, 24 pinned RPC responses also matched a later reread |
| **AG01** | Agent report publication | The watch-report workflow: a report packet is hashed and published on-chain by the NFT's linked agent. It accepts watch-observation reports only, not mission cases | Demonstrated with agent #1's linked transaction and independently checked |

These checks do not certify every AI sentence, every upstream aggregate or every application path. See [LIMITATIONS.md](LIMITATIONS.md).

## Naming history

The project began as **Sentinel Body** and was renamed **Sentinel Buddies** *after* its smart contracts were deployed. The new name applies to the website and product. Deployed identifiers, on-chain metadata titles, the repository, package names and the domain were deliberately left as they were. Older exposed testnet credentials were replaced by a fresh deployment, and the old `sentinel-body.testnet` and `sentinel-owner.testnet` accounts are retired. Older milestone documents describe earlier states, and the README and [JUDGE-GUIDE.md](JUDGE-GUIDE.md) describe the current deployment.
