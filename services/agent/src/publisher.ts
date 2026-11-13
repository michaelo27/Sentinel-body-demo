/** Publish a content-hash commitment on-chain, signed by the agent's OWN restricted function-call key. */
import { A, signAndSend } from '../../../scripts/near-tx.mjs';
import type { SnapshotT } from '@sentinel/core';
import { CFG, deployment, keystore } from './config.js';

const TESTNET_URLS = ['https://test.rpc.fastnear.com', 'https://near-testnet.drpc.org'];

export type PublishResult = {
  ok: boolean; txHash?: string; explorerUrl?: string;
  agentAccount?: string; error?: string; logs?: string[];
};

export async function publishCommitment(snapshot: SnapshotT, hash: string): Promise<PublishResult> {
  const dep = deployment();
  const ks = keystore();
  const agentAccount = dep.genesis_agent_account;
  const worker = ks?.worker;
  if (!agentAccount || !worker?.privateKey || !worker?.publicKey) {
    return { ok: false, error: 'PENDING_USER_KEYS: no agent worker key in keys/testnet.json' };
  }
  const args = {
    snapshot_id: snapshot.snapshot_id,
    content_hash: hash,
    methodology_version: snapshot.methodology_version,
    observed_block_heights: JSON.stringify(snapshot.inputs.blocks),
    uri_hint: `${CFG.gatewayBase}/api/snapshot/${snapshot.snapshot_id}`,
  };
  try {
    const r = await signAndSend({
      urls: TESTNET_URLS,
      signerId: agentAccount,
      privateKey: worker.privateKey,
      publicKey: worker.publicKey,
      receiverId: dep.nft_contract_id,
      actions: [A.functionCall('publish_snapshot', args, 100, 0n)],
    });
    if (!r.success) {
      return { ok: false, txHash: r.txHash, explorerUrl: r.explorerUrl, error: `tx failed: ${JSON.stringify(r.failure).slice(0, 220)}`, agentAccount };
    }
    return { ok: true, txHash: r.txHash, explorerUrl: r.explorerUrl, agentAccount, logs: r.logs };
  } catch (e) {
    return { ok: false, error: String((e as Error).message).slice(0, 300), agentAccount };
  }
}
