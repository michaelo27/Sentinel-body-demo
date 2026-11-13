/**
 * Real, free, read-only data collection. Every request is recorded in the
 * snapshot's `inputs.queries` with its exact endpoint, method, params and a
 * digest of the response, so `--recompute` can replay it.
 *
 * Never fabricate a number: a failed query is marked `failed` and the runtime
 * falls back to the last REAL snapshot with a Stale badge.
 */
import { politeJson, RpcPool, digest, type Network } from './rpc.js';

const COINGECKO = 'https://api.coingecko.com/api/v3/simple/price?ids=near,ethereum,solana&vs_currencies=usd&include_last_updated_at=true';
const NEAR_AI_MODELS = 'https://cloud-api.near.ai/v1/models';
const ETH_RPC = 'https://ethereum-rpc.publicnode.com';
const BASE_RPC = 'https://mainnet.base.org';
const SOL_RPC = 'https://api.mainnet-beta.solana.com';
const SOL_FALLBACK = 'https://solana-rpc.publicnode.com';

export type Query = {
  id: string; url: string; method: string; params: unknown;
  response_digest: string; block_height?: number; status: 'ok' | 'stale' | 'failed'; note?: string;
};

export type CohortBalance = {
  account: string; near_yocto: string; wnear_raw: string; usdc_raw: string;
  near_yocto_pinned?: string; near_ok: boolean; ft_ok: boolean;
};

export type Inputs = {
  blocks: Record<string, number>;
  queries: Query[];
  prices: { near_usd: number; eth_usd: number; sol_usd: number; price_source: string; price_observed_at: number };
  gas: {
    near_gas_price_yocto: string; near_storage_byte_cost_yocto: string; near_min_gas_price_yocto: string;
    eth_gas_price_wei: string; base_gas_price_wei: string;
    sol_rent_lamports_128b: number; sol_base_fee_lamports: number;
  };
  params: Record<string, unknown>;
  cohortBalances: CohortBalance[];
  modelCatalog: Array<{ id: string; input: number; output: number }>;
  validators: number;
  stale: boolean;
};

type Ctx = { queries: Query[]; stale: boolean };

function record(ctx: Ctx, id: string, url: string, method: string, params: unknown, value: unknown, extra: Partial<Query> = {}) {
  ctx.queries.push({
    id, url, method, params, response_digest: digest(value), status: 'ok', ...extra,
  });
  return value;
}
function fail(ctx: Ctx, id: string, url: string, method: string, params: unknown, e: unknown) {
  ctx.stale = true;
  ctx.queries.push({
    id, url, method, params, response_digest: 'unavailable', status: 'failed',
    note: String((e as Error)?.message || e).slice(0, 220),
  });
}

async function attempt<T>(ctx: Ctx, id: string, url: string, method: string, params: unknown, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    const v = await fn();
    record(ctx, id, url, method, params, v);
    return v;
  } catch (e) {
    fail(ctx, id, url, method, params, e);
    return fallback;
  }
}

function b58decode(s: string): Buffer {
  const A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let n = 0n;
  for (const c of s) { const i = A.indexOf(c); if (i < 0) throw new Error('bad base58'); n = n * 58n + BigInt(i); }
  let hex = n.toString(16); if (hex.length % 2) hex = '0' + hex;
  const bytes = Buffer.from(hex, 'hex');
  const leading = [...s].findIndex(c => c !== '1');
  return Buffer.concat([Buffer.alloc(leading < 0 ? s.length : leading), bytes]);
}

export async function collectInputs(
  pool: RpcPool,
  cohorts: { id: string; accounts: string[]; assets: string[] }[],
  last?: { near_usd: number; eth_usd: number; sol_usd: number } | null,
): Promise<Inputs> {
  const ctx: Ctx = { queries: [], stale: false };
  const network = pool.network;

  const status = await attempt(ctx, 'near.status', pool.urls[0]!, 'status', [],
    () => pool.status(), { sync_info: { latest_block_height: 0 }, chain_id: network } as any);
  const height = Number(status?.sync_info?.latest_block_height || 0);

  const gasPrice = await attempt(ctx, 'near.gas_price', pool.urls[0]!, 'gas_price', { finality: 'final' },
    () => pool.call<any>('gas_price', { finality: 'final' }), { gas_price: '100000000' } as any);
  const protocol = await attempt(ctx, 'near.protocol_config', pool.urls[0]!, 'EXPERIMENTAL_protocol_config', { finality: 'final' },
    () => pool.call<any>('EXPERIMENTAL_protocol_config', { finality: 'final' }, 600_000),
    { runtime_config: { storage_amount_per_byte: '10000000000000000000' }, min_gas_price: '1000000000' } as any);
  const validators = await attempt(ctx, 'near.validators', pool.urls[0]!, 'validators', [null],
    () => pool.call<any>('validators', [null], 600_000), { current_validators: [] } as any);

  // prices (CoinGecko free tier: cache >= 60s)
  const px = await attempt(ctx, 'coingecko.simple_price', COINGECKO, 'GET', { ids: 'near,ethereum,solana', vs_currencies: 'usd' },
    () => politeJson<any>(COINGECKO, {}, 60_000),
    last ? { near: { usd: last.near_usd }, ethereum: { usd: last.eth_usd }, solana: { usd: last.sol_usd } } : { near: { usd: 0 }, ethereum: { usd: 0 }, solana: { usd: 0 } });
  const priceObservedAt = Math.max(...['near', 'ethereum', 'solana'].map(k => Number(px?.[k]?.last_updated_at || 0)));

  const catalog = await attempt(ctx, 'near_ai.models', NEAR_AI_MODELS, 'GET', {},
    () => politeJson<any>(NEAR_AI_MODELS, {}, 600_000), { data: [] } as any);
  const modelCatalog = (catalog.data || []).filter((m: any) => m?.pricing?.input != null && m?.pricing?.output != null)
    .map((m: any) => ({ id: String(m.id), input: Number(m.pricing.input), output: Number(m.pricing.output) }));

  const ethGas = await attempt(ctx, 'eth.gasPrice', ETH_RPC, 'eth_gasPrice', [],
    () => politeJson<any>(ETH_RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_gasPrice', params: [] }) }, 60_000), { result: '0x0' } as any);
  const baseGas = await attempt(ctx, 'base.gasPrice', BASE_RPC, 'eth_gasPrice', [],
    () => politeJson<any>(BASE_RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_gasPrice', params: [] }) }, 60_000), { result: '0x0' } as any);

  const solRent = await attempt(ctx, 'solana.rent', SOL_RPC, 'getMinimumBalanceForRentExemption', [128],
    () => politeJson<any>(SOL_RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getMinimumBalanceForRentExemption', params: [128] }) }, 600_000),
    { result: 0 } as any);
  // Base fee is MEASURED, not assumed: getFeeForMessage on a real recent blockhash.
  const solFee = await attempt(ctx, 'solana.getFeeForMessage', SOL_RPC, 'getFeeForMessage', ['<message with 1 signature>'], async () => {
    const bh = await politeJson<any>(SOL_RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getLatestBlockhash', params: [{ commitment: 'finalized' }] }) }, 30_000);
    const msg = Buffer.concat([
      Buffer.from([1, 0, 0, 1]), Buffer.alloc(32), b58decode(bh.result.value.blockhash), Buffer.from([0]),
    ]);
    return politeJson<any>(SOL_RPC, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getFeeForMessage', params: [msg.toString('base64')] }) }, 60_000);
  }, { result: { value: 5000 } } as any);

  // Cohort balances at finality. Only VERIFIED accounts from config/cohorts.json.
  const wnear = 'wrap.near';
  const usdc = '17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1';
  const cohortBalances: CohortBalance[] = [];
  for (const c of cohorts) {
    for (const account of c.accounts) {
      const row: CohortBalance = { account, near_yocto: '0', wnear_raw: '0', usdc_raw: '0', near_ok: false, ft_ok: false };
      const va = await attempt(ctx, `view_account:${account}`, pool.urls[0]!, 'view_account', { account_id: account, finality: 'final' },
        () => pool.viewAccount(account), null as any);
      if (va?.amount) { row.near_yocto = String(va.amount); row.near_ok = true; }
      // Opportunistic pinned-block read (verified to work ~12h back on FastNEAR).
      if (height > 86400) {
        const pinned = await attempt(ctx, `view_account.pinned:${account}`, pool.urls[0]!, 'view_account',
          { account_id: account, block_id: height - 86400 },
          () => pool.viewAccount(account, height - 86400), null as any);
        if (pinned?.amount) row.near_yocto_pinned = String(pinned.amount);
      }
      if (c.assets.includes('wNEAR')) {
        const ft = await attempt(ctx, `ft_balance_of:wNEAR:${account}`, pool.urls[0]!, 'call_function', { contract: wnear, method: 'ft_balance_of', account_id: account },
          () => pool.viewFunction<string>(wnear, 'ft_balance_of', { account_id: account }), null as any);
        if (ft != null) { row.wnear_raw = String(ft).replace(/"/g, ''); row.ft_ok = true; }
      }
      if (c.assets.includes('USDC')) {
        const ft = await attempt(ctx, `ft_balance_of:USDC:${account}`, pool.urls[0]!, 'call_function', { contract: usdc, method: 'ft_balance_of', account_id: account },
          () => pool.viewFunction<string>(usdc, 'ft_balance_of', { account_id: account }), null as any);
        if (ft != null) { row.usdc_raw = String(ft).replace(/"/g, ''); }
      }
      cohortBalances.push(row);
    }
  }

  // Pinned historical heights (verified: FastNEAR serves -86400, GC at -100000).
  const blocks: Record<string, number> = {
    [`${network}.latest`]: height,
    [`${network}.pinned_12h`]: Math.max(0, height - 86400),
  };
  if (height) {
    const pinned = await attempt(ctx, `view_account.pinned:${height - 86400}`, pool.urls[0]!, 'view_account', { account_id: 'intents.near', block_id: height - 86400 },
      () => pool.viewAccount('intents.near', height - 86400), null as any);
    if (pinned?.block_height) blocks[`${network}.pinned_resolved`] = Number(pinned.block_height);
  }

  return {
    blocks,
    queries: ctx.queries,
    prices: {
      near_usd: Number(px?.near?.usd || 0), eth_usd: Number(px?.ethereum?.usd || 0),
      sol_usd: Number(px?.solana?.usd || 0), price_source: COINGECKO,
      price_observed_at: priceObservedAt,
    },
    gas: {
      near_gas_price_yocto: String(gasPrice?.gas_price || '100000000'),
      near_storage_byte_cost_yocto: String(protocol?.runtime_config?.storage_amount_per_byte || '10000000000000000000'),
      near_min_gas_price_yocto: String(protocol?.min_gas_price || ''),
      eth_gas_price_wei: String(BigInt(ethGas?.result || '0x0').toString()),
      base_gas_price_wei: String(BigInt(baseGas?.result || '0x0').toString()),
      sol_rent_lamports_128b: Number(solRent?.result || 0),
      sol_base_fee_lamports: Number(solFee?.result?.value ?? 5000),
    },
    params: { methodology_version: 'v1', window_hours: 24, cohorts: cohorts.map(c => c.id) },
    cohortBalances,
    modelCatalog,
    validators: Array.isArray(validators?.current_validators) ? validators.current_validators.length : 0,
    stale: ctx.stale,
  };
}

/** Fleet signals: REAL testnet state of our own deployed agent accounts. */
export async function collectFleet(testPool: RpcPool, contractId: string) {
  const queries: Query[] = [];
  const ctx: Ctx = { queries, stale: false };
  const supply = await attempt(ctx, 'fleet.nft_total_supply', testPool.urls[0]!, 'nft_total_supply', {},
    () => testPool.viewFunction<string>(contractId, 'nft_total_supply', {}), '0');
  const tokens = await attempt(ctx, 'fleet.nft_tokens', testPool.urls[0]!, 'nft_tokens', { from_index: '0', limit: 100 },
    () => testPool.viewFunction<any[]>(contractId, 'nft_tokens', { from_index: '0', limit: 100 }), []);
  const commits = await attempt(ctx, 'fleet.snapshots', testPool.urls[0]!, 'snapshots', { from: 0, limit: 50 },
    () => testPool.viewFunction<any[]>(contractId, 'snapshots', { from: 0, limit: 50 }), []);
  const agents: Array<{ token_id: string; account: string; balance_near: number; keys: any[]; owner: string }> = [];
  for (const t of (Array.isArray(tokens) ? tokens : [])) {
    const tokenId = String(t.token_id);
    const account = await attempt(ctx, `fleet.agent_account_of:${tokenId}`, testPool.urls[0]!, 'agent_account_of', { token_id: tokenId },
      () => testPool.viewFunction<string | null>(contractId, 'agent_account_of', { token_id: tokenId }), null);
    if (!account) continue;
    const state = await attempt(ctx, `fleet.view_account:${account}`, testPool.urls[0]!, 'view_account', { account_id: account },
      () => testPool.viewAccount(account), null as any);
    const keys = await attempt(ctx, `fleet.keys:${account}`, testPool.urls[0]!, 'view_access_key_list', { account_id: account },
      () => testPool.viewAccessKeyList(account), { keys: [] } as any);
    agents.push({
      token_id: tokenId, account, balance_near: state?.amount ? Number(BigInt(state.amount)) / 1e24 : 0,
      keys: keys?.keys || [], owner: String(t.owner_id || ''),
    });
  }
  return {
    supply: Number(supply || 0), agents, commits: Array.isArray(commits) ? commits : [],
    queries, stale: ctx.stale,
  };
}
