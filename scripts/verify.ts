/**
 * pnpm verify <snapshot_id> [--recompute]
 *
 * 1. Load the full snapshot (holder token via gateway, or the local vault).
 * 2. Re-canonicalize + SHA-256 it with the SAME code used by the runtime and
 *    the browser.
 * 3. Read the on-chain commitment via an RPC view call and compare.
 * 4. With --recompute, re-run the pinned queries and report discrepancies.
 */
import fs from 'node:fs';
import path from 'node:path';
import { RpcPool, hashSnapshot, politeJson } from '@sentinel/core';

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const id = argv.find((a) => !a.startsWith('--'));
const recompute = argv.includes('--recompute');
if (!id) {
  console.error('Usage: pnpm verify <snapshot_id> [--recompute]');
  process.exit(2);
}

const dep = JSON.parse(fs.readFileSync(path.join(ROOT, 'deployments/testnet.json'), 'utf8'));
const gateway = process.env.GATEWAY_URL || 'http://localhost:8787';
const token = process.env.HOLDER_TOKEN || '';

function green(s: string) { return `\x1b[32m${s}\x1b[0m`; }
function red(s: string) { return `\x1b[31m${s}\x1b[0m`; }
function yellow(s: string) { return `\x1b[33m${s}\x1b[0m`; }

async function loadSnapshot(): Promise<{ snapshot: any; source: string }> {
  if (token) {
    const res = await fetch(`${gateway}/api/snapshot/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`gateway ${res.status}: ${await res.text()}`);
    const j: any = await res.json();
    return { snapshot: j.snapshot, source: 'gateway (holder)' };
  }
  const p = path.join(ROOT, 'data/snapshots', `${path.basename(id!)}.json`);
  if (!fs.existsSync(p)) {
    const res = await fetch(`${gateway}/api/public/snapshot/${id}`).catch(() => null);
    if (res?.ok) {
      const j: any = await res.json();
      return { snapshot: j.snapshot, source: 'gateway (public delayed)' };
    }
    throw new Error('Snapshot not found locally and no HOLDER_TOKEN set. Set HOLDER_TOKEN or wait for the public delay.');
  }
  return { snapshot: JSON.parse(fs.readFileSync(p, 'utf8')), source: 'local vault' };
}

async function main() {
  const { snapshot, source } = await loadSnapshot();
  const computed = hashSnapshot(snapshot);
  console.log(`\nSentinel Body verification — ${id}`);
  console.log(`  snapshot source : ${source}`);
  console.log(`  methodology     : ${snapshot.methodology_version}`);
  console.log(`  observed blocks : ${JSON.stringify(snapshot.inputs.blocks)}`);
  console.log(`  queries pinned  : ${snapshot.inputs.queries.length}`);
  console.log(`  recomputed hash : ${computed}`);

  const pool = new RpcPool('testnet');
  const chain = await pool.viewFunction<any>(dep.nft_contract_id, 'snapshot_by_id', { id });
  if (!chain) {
    console.log(red('  ✗ NO ON-CHAIN COMMITMENT for this snapshot id'));
    process.exit(1);
  }
  console.log(`  on-chain hash   : ${chain.content_hash}`);
  console.log(`  published by    : ${chain.agent_account} (token #${chain.token_id})`);
  console.log(`  block           : ${chain.block_height} @ ${chain.block_timestamp}`);
  const match = computed === chain.content_hash;
  console.log(match ? green('  ✓ MATCH — the snapshot is byte-for-byte what the agent committed') : red('  ✗ MISMATCH — the snapshot was altered after commitment'));

  if (recompute) {
    console.log(`\n  --recompute: re-running pinned queries (only block-pinned ones are expected to match)`);
    const dataPool = new RpcPool(snapshot.observed_network || 'mainnet');
    let pinned = 0, matched = 0, changed = 0;
    for (const q of snapshot.inputs.queries) {
      const p: any = q.params || {};
      if (!p.block_id && !q.id.startsWith('near.')) continue;
      try {
        let value: unknown;
        if (q.method === 'view_account') value = await dataPool.viewAccount(p.account_id, p.block_id);
        else if (q.method === 'gas_price') value = await dataPool.call('gas_price', p);
        else if (q.method === 'call_function') value = await dataPool.viewFunction(p.contract || p.account_id, p.method, p);
        else continue;
        const d = (await import('@sentinel/core')).digest(value);
        pinned++;
        if (d === q.response_digest) { matched++; }
        else { changed++; console.log(yellow(`    ~ ${q.id}: response differs now (live final data changes; pinned reads should not)`)); }
      } catch (e) { console.log(yellow(`    ! ${q.id}: ${String((e as Error).message).slice(0, 90)}`)); }
    }
    console.log(`  re-ran ${pinned} queries: ${matched} identical, ${changed} changed`);
  }
  console.log('');
  if (!match) process.exit(1);
}

main().catch((e) => { console.error(red(`Verification error: ${e.message}`)); process.exit(1); });
