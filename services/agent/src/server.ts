/** Intel Vault gateway — Fastify, holder JWT, delayed public tier, dynamic art. */
import Fastify from 'fastify';
import { RpcPool, sentinelArtSvg, hashSnapshot, isValidContentHash, costModel, DEFAULT_SCENARIO, DEFAULT_ASSUMPTIONS } from '@sentinel/core';
import type { SnapshotT } from '@sentinel/core';
import { CFG, deployment, methodology, assumptions, sources, agentSignals, keystore } from './config.js';
import { A, NEAR, signAndSend } from '../../../scripts/near-tx.mjs';
import { store } from './store.js';
import { makeChallenge, verifyChallenge, requireHolder, isHolder, invalidateHolder, jwtSign, jwtVerify, verifyAttestation } from './auth.js';
import { runRound, startScheduler, roundHistory, getActivity, pushActivity } from './runtime.js';

const app = Fastify({ logger: false });
const testPool = new RpcPool('testnet');
const dataPool = new RpcPool(CFG.dataNetwork);

app.addHook('onSend', async (_req, reply, payload) => {
  reply.header('Access-Control-Allow-Origin', '*');
  reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  reply.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  reply.header('Cache-Control', 'no-store');
  return payload;
});
app.options('/*', async (_req, reply) => reply.code(204).send());

const dep = deployment();
const contractId = dep.nft_contract_id;

function delivery(s: SnapshotT | null, tier: 'public' | 'holder') {
  return {
    tier,
    mode: CFG.demoReplay ? 'replay' : 'live',
    replay: CFG.demoReplay,
    stale: s?.meta.stale || false,
    delay_minutes: CFG.publicDelayMinutes,
    age_minutes: s ? Math.max(0, Math.round((Date.now() - Date.parse(s.epoch_ts)) / 60000)) : null,
    served_at: new Date().toISOString(),
    observed_network: CFG.dataNetwork,
    settled_network: 'testnet',
  };
}

/** Public tier: headline scores + coarse chart ONLY. No breakdowns, no calculator. */
function publicView(s: SnapshotT | null) {
  if (!s) return null;
  return {
    schema: s.schema, snapshot_id: s.snapshot_id, epoch_ts: s.epoch_ts,
    methodology_version: s.methodology_version,
    headline: {
      capital_flow_net_near: s.capital_flow.total_net_near,
      cost_index_usd_per_month: s.cost_of_living.monthly.total_usd,
      agent_health: s.agent_health.score,
      agent_health_confidence: s.agent_health.confidence,
    },
    coarse_chart: s.capital_flow.cohorts.map((c) => ({ id: c.id, label: c.label, value: c.net_usd })),
    provenance: {
      observed_block_heights: s.inputs.blocks,
      price_observed_at: s.inputs.prices.price_observed_at,
      query_count: s.inputs.queries.length,
    },
    commitment: commitmentOf(s),
  };
}

function commitmentOf(s: SnapshotT) {
  return {
    content_hash: s.proof?.content_hash || null,
    commitment_tx: s.proof?.commitment_tx || null,
    commitment_status: s.proof?.commitment_status || 'unavailable',
    publisher_account: s.proof?.publisher_account || null,
    explorer_url: s.proof?.explorer_url || (s.proof?.commitment_tx ? `https://testnet.nearblocks.io/txns/${s.proof.commitment_tx}` : null),
    block_heights: s.inputs.blocks,
    methodology_version: s.methodology_version,
  };
}

async function chainCommitment() {
  try {
    const c = await testPool.viewFunction<any>(contractId, 'latest_snapshot', {});
    return c ? {
      snapshot_id: c.id, content_hash: c.content_hash, token_id: c.token_id,
      publisher_account: c.agent_account, block_height: c.block_height,
      block_timestamp: c.block_timestamp, methodology_version: c.methodology_version,
      observed_block_heights: (() => { try { return JSON.parse(c.observed_block_heights); } catch { return {}; } })(),
      explorer_url: null,
    } : null;
  } catch (e) { return { error: String((e as Error).message).slice(0, 180) }; }
}

// ------------------------------------------------------------------ health/meta
app.get('/api/health', async () => {
  const [t, d] = await Promise.all([testPool.healthCheck(), dataPool.healthCheck()]);
  const latest = store.latest();
  const src = sources();
  return {
    status: 'ok', service: 'sentinel-intel-vault', runtime_version: CFG.runtimeVersion,
    settled_network: 'testnet', observed_network: CFG.dataNetwork,
    mode: CFG.demoReplay ? 'replay' : 'live',
    nft_contract_id: contractId,
    genesis_agent_account: dep.genesis_agent_account,
    deployment_status: dep.status,
    rpc: { testnet: t, [CFG.dataNetwork]: d },
    latest_snapshot: latest ? { id: latest.snapshot_id, epoch_ts: latest.epoch_ts, hash: latest.proof?.content_hash, tx: latest.proof?.commitment_tx } : null,
    snapshots_stored: store.count(),
    sources: { checked_at: src.checked_at, checks: src.results.length, live: src.results.filter((r: any) => r.live).length },
    round_interval_minutes: CFG.roundIntervalMinutes,
    public_delay_minutes: CFG.publicDelayMinutes,
  };
});

app.get('/api/methodology', async () => ({ methodology: methodology(), assumptions: assumptions(), agent_signals: agentSignals() }));
app.get('/api/sources', async () => {
  const s = sources();
  return { checked_at: s.checked_at, total: s.results.length, live: s.results.filter((r: any) => r.live).length,
    expected_degraded: s.results.filter((r: any) => r.expected_degraded).map((r: any) => r.id),
    results: s.results };
});

// ------------------------------------------------------------------- auth spine
app.post('/auth/challenge', async (req, reply) => {
  const { accountId } = (req.body || {}) as { accountId?: string };
  if (!accountId || !/^[a-z0-9._-]+\.testnet$/.test(accountId)) return reply.code(400).send({ error: 'A valid .testnet accountId is required.' });
  const c = makeChallenge(accountId);
  pushActivity({ step: 'auth', detail: `challenge issued for ${accountId}` });
  return c;
});
app.post('/api/auth/challenge', async (req, reply) => {
  const { accountId } = (req.body || {}) as { accountId?: string };
  if (!accountId || !/^[a-z0-9._-]+\.testnet$/.test(accountId)) return reply.code(400).send({ error: 'A valid .testnet accountId is required.' });
  return makeChallenge(accountId);
});
async function doVerify(req: any, reply: any) {
  const r = await verifyChallenge((req.body || {}) as any, testPool);
  if (!r.ok) return reply.code(401).send({ error: r.error });
  pushActivity({ step: 'auth', detail: `holder session granted via ${r.method}` });
  return { token: r.token, expires_in: CFG.jwtTtlSeconds, method: r.method };
}
app.post('/auth/verify', doVerify);
app.post('/api/auth/verify', doVerify);
/** Wallet fallback: verify an attest_holder receipt returned by the wallet. */
// Client-supplied receipt JSON is not an authenticated RPC result.
// Fail closed; use NEP-413 or server-side tx lookup via /api/auth/verify.
app.post('/api/auth/attest-receipt', async (_req, reply) => {
  return reply.code(410).send({
    error: 'Client-supplied receipts are disabled. Use NEP-413 or server-verified transaction authentication.',
    code: 'UNTRUSTED_RECEIPT_DISABLED',
  });
});

async function guard(req: any, reply: any) {
  const g = await requireHolder(req, testPool);
  if (!g.ok) { reply.code(403).send({ error: g.error, code: 'HOLDER_REQUIRED' }); return null; }
  return g;
}

// --------------------------------------------------------------- public tier
app.get('/api/public/latest', async () => {
  const delayed = store.delayed(CFG.publicDelayMinutes);
  return {
    delivery: delivery(delayed, 'public'),
    snapshot: publicView(delayed),
    live_commitment: await chainCommitment(),
    locked: {
      title: 'Live full-resolution intelligence',
      unlocked_by: 'Holding a Sentinel Body',
      real_latest_hash: store.latest()?.proof?.content_hash || null,
    },
  };
});

app.get('/api/public/commitment', async () => ({ commitment: await chainCommitment(), note: 'On-chain commitments are public. Only the computed intelligence is gated.' }));
app.get('/api/public/commitments', async () => {
  const commits = await testPool.viewFunction<any[]>(contractId, 'snapshots', { from: 0, limit: 50 }).catch(() => []);
  return {
    note: 'Direct view call to sntl-02e90eacb8.testnet.snapshots — on-chain commitments are public.',
    items: (commits || []).slice().reverse().map((c: any) => {
      const local = store.get(c.id);
      return {
        ...c,
        explorer_url: local?.proof?.commitment_tx ? `https://testnet.nearblocks.io/txns/${local.proof.commitment_tx}` : null,
        commitment_tx: local?.proof?.commitment_tx || null,
        public_after_delay: store.isPublic(c.id, CFG.publicDelayMinutes),
        in_vault: !!local,
      };
    }),
  };
});

app.get('/api/public/holder', async (req) => {
  const account = String((req.query as any).account || '');
  return { account_id: account, is_holder: /^[a-z0-9._-]+\.testnet$/.test(account) ? await isHolder(account, testPool) : false, checked_at: new Date().toISOString(), source: 'view call: sntl-02e90eacb8.testnet.is_holder' };
});

app.get('/api/public/snapshot/:id', async (req, reply) => {
  const { id } = req.params as { id: string };
  if (!store.isPublic(id, CFG.publicDelayMinutes)) return reply.code(403).send({ error: 'This snapshot is still inside the public delay window.' });
  const s = store.get(id);
  if (!s) return reply.code(404).send({ error: 'Snapshot not found.' });
  // ?full=1 releases the COMPLETE delayed snapshot so anyone can recompute the
  // hash in their own browser with WebCrypto. Live snapshots stay holder-only.
  if ((req.query as any)?.full === '1') {
    return { delivery: { ...delivery(s, 'public'), released_full_snapshot: true }, snapshot: s, commitment: commitmentOf(s), recomputed_hash: hashSnapshot(s), note: 'Full-resolution data is released only after the public delay. Verify the hash locally with WebCrypto; do not trust this recomputed_hash field.' };
  }
  return { delivery: delivery(s, 'public'), snapshot: publicView(s) };
});

/** Interactive Cost-of-Living calculator: the SAME pure function the runtime uses. */
app.post('/api/cost/quote', async (req, reply) => {
  const s = store.latest();
  if (!s) return reply.code(503).send({ error: 'No live snapshot yet; cannot quote without real parameters.' });
  const body = (req.body || {}) as any;
  const modelId = String(body.model || DEFAULT_SCENARIO.model);
  const model = (assumptions().inference?.models || []).find((m: any) => m.id === modelId) || null;
  if (!model) return reply.code(400).send({ error: 'Unknown model. Choose one from /api/methodology.' });
  const scenario = {
    agents: clampNum(body.agents, 1, 10000, 10), txPerAgentDay: clampNum(body.txPerAgentDay, 1, 100000, 100),
    avgTgasPerTx: clampNum(body.avgTgasPerTx, 0.01, 300, 0.3), persistentStorageMB: clampNum(body.persistentStorageMB, 0, 10000, 1),
    inferenceTokensPerDay: clampNum(body.inferenceTokensPerDay, 0, 1e9, 200000), model: modelId,
    infraUsdPerMonth: clampNum(body.infraUsdPerMonth, 0, 1e7, 0),
  };
  const i = s.inputs;
  const live = {
    nearGasPriceYocto: i.gas.near_gas_price_yocto, storageByteCostYocto: i.gas.near_storage_byte_cost_yocto,
    nearUsd: i.prices.near_usd, ethUsd: i.prices.eth_usd, solUsd: i.prices.sol_usd,
    ethGasPriceWei: i.gas.eth_gas_price_wei, baseGasPriceWei: i.gas.base_gas_price_wei,
    solRentLamports128b: i.gas.sol_rent_lamports_128b, solBaseFeeLamports: i.gas.sol_base_fee_lamports,
    modelInputUsdPer1m: model.input_usd_per_1m, modelOutputUsdPer1m: model.output_usd_per_1m,
  };
  return {
    scenario, result: costModel(scenario, live, DEFAULT_ASSUMPTIONS),
    live_params: { ...i.gas, ...i.prices, model_id: modelId, model_kind: 'published_catalog', model_source: assumptions().inference.source_url },
    provenance: { snapshot_id: s.snapshot_id, epoch_ts: s.epoch_ts, observed_block_heights: i.blocks, mode: s.meta.mode, stale: s.meta.stale },
    labels: { model: 'Published catalog', gas: 'Live RPC', storage: 'Live RPC (locked capital, not spent)', evm_gas_units: 'ASSUMPTION', sol_signatures: 'ASSUMPTION', utilization: 'ASSUMPTION', inference_split: 'ASSUMPTION' },
  };
});

app.get('/api/public/verify', async (req) => {
  const q = String((req.query as any).q || '').trim();
  if (!q) return { error: 'Provide ?q=<snapshot_id or 64-char hash>' };
  const all = store.all();
  let s = all.find((x) => x.snapshot_id === q) || null;
  if (!s && isValidContentHash(q)) s = all.find((x) => x.proof?.content_hash === q) || null;
  if (!s) {
    // fall back to the on-chain commitment view (public, no vault needed)
    const commits = await testPool.viewFunction<any[]>(contractId, 'snapshots', { from: 0, limit: 50 }).catch(() => []);
    const c = (commits || []).find((x) => x.id === q || x.content_hash === q);
    if (c) return { found: true, source: 'on-chain', commitment: c, vault_snapshot: null, note: 'The commitment is public; the full snapshot is released after the public delay.' };
    return { found: false, error: 'No commitment matches that ID or hash.' };
  }
  return {
    found: true, source: 'vault',
    commitment: commitmentOf(s),
    recomputed_hash: hashSnapshot(s),
    matches: hashSnapshot(s) === s.proof?.content_hash,
    public_after_delay: store.isPublic(s.snapshot_id, CFG.publicDelayMinutes),
    vault_snapshot: store.isPublic(s.snapshot_id, CFG.publicDelayMinutes) ? publicView(s) : null,
  };
});

// ---------------------------------------------------------------- holder tier
app.get('/api/vault/latest', async (req, reply) => {
  if (!(await guard(req, reply))) return;
  const s = store.latest();
  if (!s) return reply.code(404).send({ error: 'No snapshot yet. Run pnpm agent:run.' });
  return { delivery: delivery(s, 'holder'), snapshot: s, commitment: commitmentOf(s), previous: store.previous()?.snapshot_id || null };
});

app.get('/api/vault/history', async (req, reply) => {
  if (!(await guard(req, reply))) return;
  return { delivery: delivery(store.latest(), 'holder'), items: store.list(Number((req.query as any).limit || 50)) };
});

app.get('/api/snapshot/:id', async (req, reply) => {
  if (!(await guard(req, reply))) return;
  const { id } = req.params as { id: string };
  const s = store.get(id);
  if (!s) return reply.code(404).send({ error: 'Snapshot not found.' });
  return { delivery: delivery(s, 'holder'), snapshot: s, commitment: commitmentOf(s), recomputed_hash: hashSnapshot(s) };
});

// ---------------------------------------------------------------- agent console
app.get('/api/agent/:id', async (req) => {
  const { id } = req.params as { id: string };
  const account = await testPool.viewFunction<string | null>(contractId, 'agent_account_of', { token_id: id }).catch(() => null);
  const token = await testPool.viewFunction<any>(contractId, 'nft_token', { token_id: id }).catch(() => null);
  if (!account || !token) return { error: 'Agent not found', token_id: id };
  const state = await testPool.viewAccount(account).catch(() => null);
  const keys = await testPool.viewAccessKeyList(account).catch(() => ({ keys: [] }));
  const commits = await testPool.viewFunction<any[]>(contractId, 'snapshots', { from: 0, limit: 50 }).catch(() => []);
  const own = (commits || []).filter((c) => c.agent_account === account);
  return {
    token_id: id, owner_id: token.owner_id, agent_account: account,
    balance_near: state ? Number(BigInt(state.amount)) / 1e24 : null,
    storage_usage_bytes: state?.storage_usage ?? null,
    access_keys: keys.keys,
    no_full_access_key: !keys.keys.some((k: any) => k.access_key.permission === 'FullAccess'),
    commitments: own,
    activity: getActivity().slice(0, 20),
    rounds: roundHistory().slice(0, 10),
    explorer_url: `https://testnet.nearblocks.io/accounts/${account}`,
  };
});

app.get('/api/mint/quote', async () => {
  const cfg = await testPool.viewFunction<any>(contractId, 'config', {}).catch(() => null);
  return {
    contract_id: contractId,
    next_token_id: cfg?.next_token_id ?? null,
    mint_cost_near: cfg ? Number(BigInt(cfg.mint_cost_yocto)) / 1e24 : null,
    breakdown: {
      controller_wasm_bytes: cfg?.controller_wasm_bytes,
      storage_cost_per_byte_yocto: cfg?.storage_byte_cost_yocto,
      seed_balance_near: cfg?.seed_balance_near,
      worker_allowance_near: cfg?.worker_allowance_near,
      note: 'About 1 NEAR per 100 KB of locked storage, so each agent costs ~1.9 free TESTNET NEAR. See contracts/README.md.',
    },
    explorer_url: `https://testnet.nearblocks.io/accounts/${contractId}`,
  };
});

// ------------------------------------------------------------------ dynamic art
app.get('/api/nft/:id/art.svg', async (req, reply) => {
  const { id } = req.params as { id: string };
  const account = await testPool.viewFunction<string | null>(contractId, 'agent_account_of', { token_id: id }).catch(() => null);
  const commits = await testPool.viewFunction<any[]>(contractId, 'snapshots', { from: 0, limit: 50 }).catch(() => []);
  const own = (commits || []).filter((c) => c.agent_account === account);
  const last = own.length ? Number(own[own.length - 1]!.block_timestamp) : 0;
  const state = account ? await testPool.viewAccount(account).catch(() => null) : null;
  const lowFuel = state ? Number(BigInt(state.amount)) / 1e24 < 0.4 : false;
  const svg = await sentinelArtSvg(id, account || `agent-${id}.${contractId}`, {
    publishes: own.length,
    lastPublishMsAgo: last ? Date.now() - last : 1e12,
    lowFuel,
  });
  reply.header('Content-Type', 'image/svg+xml; charset=utf-8');
  reply.header('Cache-Control', 'public, max-age=30');
  return svg;
});

// ------------------------------------------------------------------ admin / ops
app.post('/admin/run-now', async (req, reply) => {
  if (CFG.adminToken && String((req.headers as any)['x-admin-token'] || '') !== CFG.adminToken) return reply.code(401).send({ error: 'Admin token required.' });
  const r = await runRound();
  return { ...r, ok: r.ok };
});
app.get('/admin/rounds', async () => ({ rounds: roundHistory(), activity: getActivity().slice(0, 30) }));
app.post('/admin/invalidate-holder', async (req) => { invalidateHolder((req.body as any)?.accountId); return { ok: true }; });


/** Wait for the RPC view to reflect a transfer, then clear the holder cache. */
async function confirmOwner(tokenId: string, expectedOwner: string, accounts: string[], tries = 24): Promise<{ confirmed: boolean; owner_id: string | null }> {
  let owner: string | null = null;
  for (let i = 0; i < tries; i++) {
    const t = await testPool.viewFunction<any>(contractId, 'nft_token', { token_id: tokenId }).catch(() => null);
    owner = t?.owner_id || null;
    if (owner === expectedOwner) {
      accounts.forEach(invalidateHolder);
      return { confirmed: true, owner_id: owner };
    }
    await new Promise((r) => setTimeout(r, 1200));
  }
  accounts.forEach(invalidateHolder);
  return { confirmed: false, owner_id: owner };
}

function clampNum(v: unknown, lo: number, hi: number, d: number): number { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; }

// ------------------------------------------------------- judge-demo helpers
// DEMO ONLY. These endpoints sign with the organizer's TESTNET keys so a judge
// can complete the whole flow in a browser without installing a wallet. Every
// action is a REAL testnet transaction; the UI badges these as "Demo session".
// Production uses the wallet + NEP-413 path above.
const DEMO_URLS = ['https://test.rpc.fastnear.com', 'https://rpc.testnet.near.org', 'https://near-testnet.drpc.org'];
function demoDisabled(req: any, reply: any, needSession = true): boolean {
  if (!CFG.demoMode) {
    reply.code(403).send({ error: 'Demo endpoints are disabled (DEMO_MODE=0). Use a testnet wallet instead.' });
    return true;
  }
  if (!needSession) return false;
  if (CFG.adminToken && req.headers['x-demo-key'] === CFG.adminToken) return false;
  const auth = String(req.headers.authorization || '');
  const jwt = auth.startsWith('Bearer ') ? jwtVerify(auth.slice(7)) : null;
  const ids = Object.values(keystore()?.accounts || {}).map((a: any) => a.accountId);
  if (jwt?.sub && ids.includes(jwt.sub)) return false;
  reply.code(401).send({ error: 'A demo preview session is required. Connect one of the organizer demo accounts first.' });
  return true;
}

app.get('/api/demo/status', async () => {
  const ks = keystore();
  const admin = ks?.accounts?.admin?.accountId || null;
  const second = ks?.accounts?.second?.accountId || null;
  const token = await testPool.viewFunction<any>(contractId, 'nft_token', { token_id: '0' }).catch(() => null);
  const cfg = await testPool.viewFunction<any>(contractId, 'config', {}).catch(() => null);
  return {
    contract_id: contractId, admin, second,
    genesis_token: { token_id: '0', owner_id: token?.owner_id || null, agent_account: await testPool.viewFunction<string | null>(contractId, 'agent_account_of', { token_id: '0' }).catch(() => null) },
    total_supply: await testPool.viewFunction<string>(contractId, 'nft_total_supply', {}).catch(() => null),
    next_token_id: cfg?.next_token_id ?? null,
    is_holder: {
      ...(admin ? { [admin]: await isHolder(admin, testPool) } : {}),
      ...(second ? { [second]: await isHolder(second, testPool) } : {}),
    },
    checked_at: new Date().toISOString(),
  };
});

app.post('/api/demo/session', async (req, reply) => {
  if (demoDisabled(req, reply, false)) return;
  const { accountId } = (req.body || {}) as { accountId?: string };
  if (!accountId) return reply.code(400).send({ error: 'accountId required' });
  let exists = true;
  try { await testPool.viewAccount(accountId); } catch { exists = false; }
  if (!exists) return reply.code(400).send({ error: `${accountId} does not exist on NEAR testnet.` });
  const holder = await isHolder(accountId, testPool);
  const token = jwtSign({ sub: accountId, scope: 'preview', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + CFG.jwtTtlSeconds, demo: true });
  pushActivity({ step: 'auth', detail: `DEMO preview session for ${accountId}; on-chain is_holder=${holder}` });
  return { token, expires_in: CFG.jwtTtlSeconds, scope: 'preview', is_holder: holder, method: 'demo_session', warning: 'Preview session only: no vault access until a real ownership proof (NEP-413 signature or attest_holder transaction).' };
});

app.post('/api/demo/mint', async (req, reply) => {
  if (demoDisabled(req, reply)) return;
  const { accountId } = (req.body || {}) as { accountId?: string };
  if (!accountId || !/^[a-z0-9._-]+\.testnet$/.test(accountId)) return reply.code(400).send({ error: 'A valid existing .testnet accountId is required.' });
  const ks = keystore(); const admin = ks?.accounts?.admin;
  if (!admin) return reply.code(500).send({ error: 'Organizer key missing' });
  try {
    await testPool.viewAccount(accountId);
  } catch { return reply.code(400).send({ error: `${accountId} does not exist on testnet. Create a testnet account first.` }); }
  const cfg = await testPool.viewFunction<any>(contractId, 'config', {});
  const tokenId = String(cfg.next_token_id);
  const cost = BigInt(cfg.mint_cost_yocto);
  const r = await signAndSend({
    urls: DEMO_URLS, signerId: admin.accountId, privateKey: admin.privateKey, publicKey: admin.publicKey,
    receiverId: contractId,
    actions: [A.functionCall('mint_agent', { receiver_id: accountId }, 300, cost + NEAR / 10n)],
  });
  if (!r.success) return reply.code(500).send({ error: `Mint tx failed: ${JSON.stringify(r.failure)}`, tx: r.txHash, explorer: r.explorerUrl });
  let agentAccount: string | null = null;
  for (let i = 0; i < 20; i++) {
    agentAccount = await testPool.viewFunction<string | null>(contractId, 'agent_account_of', { token_id: tokenId }).catch(() => null);
    if (agentAccount) break;
    await new Promise((res) => setTimeout(res, 1500));
  }
  invalidateHolder(accountId);
  pushActivity({ step: 'mint', detail: `REAL mint: token #${tokenId} -> ${accountId} (${agentAccount || 'provisioning'})` });
  return {
    token_id: tokenId, owner: accountId, agent_account: agentAccount,
    tx: r.txHash, explorer_url: r.explorerUrl,
    art_url: `/api/nft/${tokenId}/art.svg`,
    note: 'Real testnet transaction, funded with free faucet NEAR and signed by the organizer account because this is a no-wallet demo.',
  };
});

app.post('/api/demo/attest', async (req, reply) => {
  if (demoDisabled(req, reply)) return;
  const { accountId } = (req.body || {}) as { accountId?: string };
  const ks = keystore();
  const entry = Object.values(ks?.accounts || {}).find((a: any) => a.accountId === accountId) as any;
  if (!accountId || !entry) return reply.code(400).send({ error: 'No organizer testnet key for this account. Use a wallet for NEP-413 / attest_holder instead.' });
  const c = makeChallenge(accountId);
  const r = await signAndSend({
    urls: DEMO_URLS, signerId: accountId, privateKey: entry.privateKey, publicKey: entry.publicKey,
    receiverId: contractId,
    actions: [A.functionCall('attest_holder', { nonce: c.nonce }, 60, 1n)],
  });
  if (!r.success) return reply.code(500).send({ error: `attest_holder tx failed: ${JSON.stringify(r.failure)}`, tx: r.txHash, explorer_url: r.explorerUrl });
  const v = await verifyAttestation({
    accountId, nonce: c.nonce, txHash: r.txHash,
    signerId: r.result?.transaction?.signer_id || accountId,
    failure: r.failure, logs: r.logs,
  }, testPool);
  if (!v.ok) return reply.code(401).send({ error: v.error, tx: r.txHash, explorer_url: r.explorerUrl });
  pushActivity({ step: 'auth', detail: `REAL on-chain ownership proof: attest_holder for ${accountId} (${r.txHash})` });
  return { token: v.token, scope: 'holder', expires_in: CFG.jwtTtlSeconds, method: v.method, tx: r.txHash, explorer_url: r.explorerUrl, nonce: c.nonce };
});

app.post('/api/demo/transfer', async (req, reply) => {
  if (demoDisabled(req, reply)) return;
  const { to: requestedTo, tokenId } = (req.body || {}) as { to?: string; tokenId?: string };
  const ks = keystore(); const admin = ks?.accounts?.admin; const second = ks?.accounts?.second;
  const to = requestedTo || second?.accountId;
  if (!to || !admin) return reply.code(400).send({ error: 'to and organizer key required' });
  const tid = tokenId || '0';
  const token = await testPool.viewFunction<any>(contractId, 'nft_token', { token_id: tid });
  if (!token) return reply.code(404).send({ error: 'token not found' });
  if (token.owner_id !== admin.accountId) return reply.code(400).send({ error: `Genesis is currently owned by ${token.owner_id}; transfer it back first.` });
  const r = await signAndSend({
    urls: DEMO_URLS, signerId: admin.accountId, privateKey: admin.privateKey, publicKey: admin.publicKey,
    receiverId: contractId,
    actions: [A.functionCall('nft_transfer', { receiver_id: to, token_id: tid }, 100, 1n)],
  });
  if (!r.success) return reply.code(500).send({ error: `nft_transfer failed: ${JSON.stringify(r.failure)}`, tx: r.txHash, explorer_url: r.explorerUrl });
  const confirmed = await confirmOwner(tid, to, [admin.accountId, to]);
  pushActivity({ step: 'transfer', detail: `REAL nft_transfer #${tid}: ${admin.accountId} -> ${to} (${r.txHash}) · view-confirmed=${confirmed.confirmed}` });
  return { tx: r.txHash, explorer_url: r.explorerUrl, from: admin.accountId, to, token_id: tid, success: true, confirmed: confirmed.confirmed, owner_id: confirmed.owner_id };
});

app.post('/api/demo/transfer-back', async (req, reply) => {
  if (demoDisabled(req, reply)) return;
  const { tokenId } = (req.body || {}) as { tokenId?: string };
  const ks = keystore(); const admin = ks?.accounts?.admin; const second = ks?.accounts?.second;
  if (!admin || !second) return reply.code(400).send({ error: 'demo accounts missing' });
  const tid = tokenId || '0';
  const r = await signAndSend({
    urls: DEMO_URLS, signerId: second.accountId, privateKey: second.privateKey, publicKey: second.publicKey,
    receiverId: contractId,
    actions: [A.functionCall('nft_transfer', { receiver_id: admin.accountId, token_id: tid }, 100, 1n)],
  });
  if (!r.success) return reply.code(500).send({ error: `nft_transfer failed: ${JSON.stringify(r.failure)}`, tx: r.txHash, explorer_url: r.explorerUrl });
  const confirmed = await confirmOwner(tid, admin.accountId, [admin.accountId, second.accountId]);
  pushActivity({ step: 'transfer', detail: `REAL nft_transfer #${tid}: ${second.accountId} -> ${admin.accountId} (${r.txHash}) · view-confirmed=${confirmed.confirmed}` });
  return { tx: r.txHash, explorer_url: r.explorerUrl, from: second.accountId, to: admin.accountId, token_id: tid, success: true, confirmed: confirmed.confirmed, owner_id: confirmed.owner_id };
});

// ---------------------------------------------------------------------- startup
const start = async () => {
  await Promise.all([testPool.healthCheck(), dataPool.healthCheck()]);
  pushActivity({ step: 'boot', detail: `gateway up; ${CFG.dataNetwork} observe / testnet settle; replay=${CFG.demoReplay}` });
  if (!store.latest()) {
    console.log('[sentinel] no snapshot stored yet — running a first real round...');
    try { const r = await runRound(); console.log('[sentinel] first round:', r.snapshot_id, r.tx || r.error); }
    catch (e) { console.warn('[sentinel] first round failed:', (e as Error).message); }
  }
  if (!CFG.demoReplay) startScheduler();
  await app.listen({ port: CFG.port, host: CFG.host });
  console.log(`[sentinel] Intel Vault gateway listening on 0.0.0.0:${CFG.port}`);
  console.log(`[sentinel] NFT contract: ${contractId} · Genesis: ${dep.genesis_agent_account}`);
};
start().catch((e) => { console.error(e); process.exit(1); });

export { app };
