/** CLI: pnpm agent:run — one real fetch → compute → hash → commit round. */
import { runRound } from './runtime.js';
import { CFG } from './config.js';

const r = await runRound({ replay: CFG.demoReplay });
console.log('\n=== Sentinel Body agent round ===');
console.log(JSON.stringify({
  ok: r.ok, snapshot_id: r.snapshot_id, mode: r.mode, stale: r.stale,
  content_hash: r.content_hash,
  commitment_tx: r.tx,
  explorer: r.explorer_url || (r.tx ? `https://testnet.nearblocks.io/txns/${r.tx}` : null),
  notes: r.notes, error: r.error,
}, null, 2));
if (!r.ok && !r.tx) process.exitCode = 1;
