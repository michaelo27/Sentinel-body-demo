# Holder guide

For people who own a Sentinel NFT. You need a **testnet wallet that currently owns a Sentinel NFT**. There is no universal demo login, and no organizer private key is supplied. If you only want to inspect the project, use [VERIFY.md](VERIFY.md) instead.

> **Name note:** the product is *Sentinel Buddies*. Some on-chain metadata, the repository and the domain still say *Sentinel Body* because the rename happened after contracts were deployed. It is the same project. See the naming notice at the top of the [README](../README.md).

## 1. Enter the Vault

Connect your wallet, then prove ownership by signing a challenge. Connecting alone does not grant access, and ownership is rechecked on every NFT-gated request.

## 2. Investigate before you guess

Enter a NEAR account or transaction. The read-only investigator reports what the chain records and does not ask AI to invent a story.

- **Account checks:** native NEAR amount, locked balance, storage use, contract presence and access-key permissions at a finalized block. Full-access and function-call keys are distinguished. A public key does not identify its human owner.
- **Transaction checks:** supply the transaction hash and signer account to inspect finalized status, actions, attached deposits, execution outcomes and burnt fees. Execution accounts shown are not automatically money recipients.
- **Safety:** these checks never sign transactions, move funds or call the paid AI model. The interface shows up to 20 keys or actions. It is not a full token portfolio, a transaction-history index or a security verdict.

## 3. Buddy missions

Open your buddy's desk and pick a mission. Evidence collection and AI explanation are **two separate steps** with explicit consent between them.

| Action | Expected result |
|---|---|
| Open Vault, authenticate, enter your NFT ID, select **Open my buddy's desk** | Your linked agent identity, private priorities and case history load |
| Choose **Investigate an account**, **Unpack a transaction**, **What changed for me?** or **Brief me on NEAR** | A bounded read-only plan explains what evidence will be collected and its limits |
| Supply the required account/network or transaction hash/signer, optionally add a question, click **Collect evidence — no AI charge** | A case file with a tool log, readable recorded facts, evidence gaps and a source notebook. No model call, no transaction |
| Inspect the evidence, give consent, click **Ask my buddy to explain the evidence** once | **AI SYNTHESIS / COMPLETE**, a readout, source-linked findings, unresolved questions, next checks and provider-reported token usage. This step can incur an AI charge |
| Reopen the case from history | The saved explanation returns without another inference. Failed or pending attempts are kept and never retried automatically |
| For personal briefings, save watches in **My buddy priorities & memory**, collect a personal case, choose **Mark reviewed** | The next briefing compares newer saved observations with your reviewed baseline. Opening a case alone does not advance it |

**Reproduce the demonstrated transaction mission:** on NEAR testnet, use transaction hash `EPrjhgDpKxA6s2PZwm9QvuiacqtRXYx1uyshv9ahN1zL` and signer `agent-1.sntl-02e90eacb8.testnet`, and ask "What did my agent publish, did the transaction complete, and what does this transaction prove?" Recorded execution completed with one `publish_snapshot` action, zero attached NEAR and **0.0002771052331897 NEAR** burnt across returned outcomes. Investigating it sends no new transaction.

The owner's completed AI response for that case also overstated what could be concluded about recipients and broader history. Prompt instructions were later tightened, and the old result was kept rather than silently rewritten.

### Memory and privacy

- Up to three existing watches, a priority and a reporting style are stored per holder and buddy.
- Personal briefings use **saved observations**, not continuous live scans or scheduled model calls.
- Account-permission comparisons need saved account missions. A preference does not enable background key monitoring.
- Cases and preferences are private to the creating holder and the selected NFT. **A new NFT owner does not inherit private history.**
- Case and model records remain after a watch is removed.
- **Case files are not publication packets.** Downloading case JSON or its checksum does not publish anything on-chain, and the report publisher does not accept mission exports.

## 4. Watch accounts, then ask your AI

Save accounts you care about, set a low-balance warning threshold and compare genuine observations. Code calculates balance changes before the model explains anything, and AI text is shown separately from recorded facts. With one observation there is no comparison and no invented second reading.

### Watch-to-report walkthrough

1. **Save a valid mainnet or testnet account and threshold** under *My monitored accounts*. The collector targets a 15-minute interval. It is not an instant refresh. Existing watches may already have history.
2. **Inspect two recorded observations.** You see source RPC URLs, block hashes and heights, timestamps and the code-calculated change. Stale and error states are explicit.
3. **Explain my saved observations:** choose the watch, read the consent text and click **Explain saved evidence** once. NEAR AI provides an interpretation below the deterministic facts. Errors stay errors. A successful report can be reopened from AI execution history without another model call.
4. **Prepare a report packet:** open a completed report, enter an NFT ID you own, consent and choose **Prepare & download report packet**. This produces a private JSON packet and a prepared task. It sends no transaction and makes no new AI call.
5. **Operator publication:** the configured operator runs the local publisher's read-only preflight, then explicitly approves. The local process signs as that NFT's agent with its restricted key. This is not something every holder can do without operator and key provisioning.
6. **Click Check on-chain publication.** The result is `PUBLISHED · ON-CHAIN MATCH` only when the contract commitment matches agent, token and report hash. An unsubmitted packet, RPC failure or pruned commitment is never labelled a success.
7. **Explore the shared intelligence** below the holder tools. See [INTELLIGENCE-TOOLS.md](INTELLIGENCE-TOOLS.md).

Publisher commands and access boundaries: [JUDGE-GUIDE.md](JUDGE-GUIDE.md). Never commit private data, report packets or signing keys to Git.
