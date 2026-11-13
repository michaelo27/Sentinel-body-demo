/**
 * Agent runtime loop: fetch real free data -> compute three indices -> canonical
 * hash -> persist full snapshot -> publish the hash on testnet with the agent's
 * restricted key -> attach the tx hash.
 *
 * On any failure the last GOOD real snapshot keeps being served with a Stale
 * badge. Nothing is ever synthesized.
 */
import {
  RpcPool, collectInputs, collectFleet, buildSnapshot, hashSnapshot,
  type SnapshotT,
} from '@sentinel/core';
import { CFG, cohorts, deployment } from './config.js';
import { store } from './store.js';
import { publishCommitment } from './publisher.js';

export type RoundResult = {
  ok: boolean; snapshot_id: string; content_hash: string;
  tx: string | null; explorer_url?: string; mode: 'live' | 'replay';
  stale: boolean; notes: string[]; error?: string;
};

const history: RoundResult[] = [];
export function roundHistory() { return history.slice(-30).reverse(); }
export function pushActivity(entry: { step: string; detail: string; at?: string; ok?: boolean }) {
  activity.unshift({ ...entry, at: entry.at || new Date().toISOString(), ok: entry.ok ?? true });
  activity.splice(60);
}
const activity: Array<{ step: string; detail: string; at: string; ok: boolean }> = [];
export function getActivity() { return activity; }

export async function runRound(opts: { replay?: boolean } = {}): Promise<RoundResult> {
  if (opts.replay || CFG.demoReplay) {
    const recorded = store.all();
    if (!recorded.length) throw new Error('DEMO_REPLAY needs at least one recorded REAL snapshot');
    const s = recorded[(Math.floor(Date.now() / 60000)) % recorded.length]!;
    pushActivity({ step: 'replay', detail: `Replaying recorded real snapshot ${s.snapshot_id}` });
    const result: RoundResult = {
      ok: true, snapshot_id: s.snapshot_id, content_hash: s.proof?.content_hash || '',
      tx: s.proof?.commitment_tx || null, mode: 'replay', stale: s.meta.stale,
      notes: ['REPLAY: previously recorded real snapshot. No new observation and no new transaction.'],
    };
    history.push(result);
    return result;
  }

  const dep = deployment();
  const dataPool = new RpcPool(CFG.dataNetwork);
  const testPool = new RpcPool('testnet');
  const [dataHealth, testHealth] = await Promise.all([dataPool.healthCheck(), testPool.healthCheck()]);
  pushActivity({
    step: 'health',
    detail: `${CFG.dataNetwork}: ${dataHealth.filter(h => h.live).length}/${dataHealth.length} live · testnet: ${testHealth.filter(h => h.live).length}/${testHealth.length} live`,
    ok: dataHealth.some(h => h.live) && testHealth.some(h => h.live),
  });

  const last = store.latest();
  const cfgCohorts = cohorts();
  let inputs;
  try {
    inputs = await collectInputs(dataPool, cfgCohorts.cohorts, last?.inputs.prices || null);
  } catch (e) {
    // Total data-source failure: serve the last real snapshot, badged stale.
    if (!last) throw e;
    pushActivity({ step: 'fetch', detail: `all sources failed, serving last real snapshot ${last.snapshot_id}`, ok: false });
    return {
      ok: false, snapshot_id: last.snapshot_id, content_hash: last.proof?.content_hash || '',
      tx: last.proof?.commitment_tx || null, mode: 'live', stale: true,
      notes: ['STALE: free sources unavailable; last real snapshot served unchanged.'],
      error: String((e as Error).message),
    };
  }
  pushActivity({ step: 'fetch', detail: `${inputs.queries.length} real queries, ${inputs.queries.filter(q => q.status === 'failed').length} failed`, ok: !inputs.stale });

  const fleet = await collectFleet(testPool, dep.nft_contract_id);
  pushActivity({ step: 'fleet', detail: `${fleet.agents.length} agents, ${fleet.commits.length} on-chain commitments` });
  // Testnet reads are pinned as inputs too.
  inputs.queries.push(...fleet.queries);
  inputs.stale = inputs.stale || fleet.stale;

  const snapshot: SnapshotT = buildSnapshot({
    inputs, cohorts: cfgCohorts.cohorts, fleet,
    previous: last, mode: 'live', runtimeVersion: CFG.runtimeVersion,
    agentTokenId: '0', agentAccount: dep.genesis_agent_account || '',
    observedNetwork: CFG.dataNetwork,
  });
  const hash = hashSnapshot(snapshot);
  pushActivity({ step: 'compute', detail: `health ${snapshot.agent_health.score} · net ${snapshot.capital_flow.total_net_near} NEAR · $${snapshot.cost_of_living.monthly.total_usd}/mo` });
  pushActivity({ step: 'hash', detail: hash });

  // Persist the FULL snapshot BEFORE committing.
  snapshot.proof = {
    content_hash: hash,
    commitment_status: 'pending',
    publisher_account: dep.genesis_agent_account || '',
  };
  store.save(snapshot);

  const pub = await publishCommitment(snapshot, hash);
  snapshot.proof = {
    content_hash: hash,
    commitment_tx: pub.txHash || null,
    commitment_status: pub.ok ? 'confirmed' : 'unavailable',
    publisher_account: pub.agentAccount || dep.genesis_agent_account || '',
    explorer_url: pub.explorerUrl,
  };
  store.save(snapshot);
  pushActivity({
    step: 'commit', detail: pub.ok ? `tx ${pub.txHash}` : `commit failed: ${pub.error}`, ok: pub.ok,
  });

  const result: RoundResult = {
    ok: pub.ok, snapshot_id: snapshot.snapshot_id, content_hash: hash,
    tx: pub.txHash || null, explorer_url: pub.explorerUrl, mode: 'live',
    stale: snapshot.meta.stale,
    notes: pub.ok ? pub.logs || [] : [`Commitment unavailable: ${pub.error}. The full snapshot is stored and verifiable locally; the on-chain commitment will be retried next round.`],
    error: pub.ok ? undefined : pub.error,
  };
  history.push(result);
  return result;
}

export function startScheduler() {
  const ms = Math.max(1, CFG.roundIntervalMinutes) * 60_000;
  pushActivity({ step: 'scheduler', detail: `round interval ${CFG.roundIntervalMinutes} min · DEMO_REPLAY=${CFG.demoReplay}` });
  const timer = setInterval(() => {
    runRound().catch((e) => pushActivity({ step: 'error', detail: String(e.message), ok: false }));
  }, ms);
  timer.unref();
  return timer;
}
