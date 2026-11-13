import { describe, it, expect } from 'vitest';
import { canonicalize, hashable, isValidContentHash, hashSnapshotBrowser } from '../src/canonical.js';
import { sha256Hex, hashSnapshot } from '../src/hash-node.js';
import { costModel, DEFAULT_SCENARIO, DEFAULT_ASSUMPTIONS } from '../src/cost-model.js';
import { capitalFlow, agentHealth } from '../src/indices.js';
import { sentinelArtSvg } from '../src/art.js';
import { nep413Digest, verifyNep413Signature } from '../src/nep413.js';
import { b58encode } from '../src/base58.js';
import crypto from 'node:crypto';

const LIVE = {
  nearGasPriceYocto: '100000000', storageByteCostYocto: '10000000000000000000',
  nearUsd: 3.44, ethUsd: 3000, solUsd: 150,
  ethGasPriceWei: '1000000000', baseGasPriceWei: '1000000',
  solRentLamports128b: 1300480, solBaseFeeLamports: 5000,
  modelInputUsdPer1m: 0.04, modelOutputUsdPer1m: 1.35,
};

describe('canonical JCS + hashing', () => {
  it('sorts keys recursively and is stable regardless of insertion order', () => {
    const a = { z: 1, a: { y: [3, { d: 2, c: 1 }], b: 'x' } };
    const b = { a: { b: 'x', y: [3, { c: 1, d: 2 }] }, z: 1 };
    expect(canonicalize(a)).toBe(canonicalize(b));
    expect(canonicalize(a)).toBe('{"a":{"b":"x","y":[3,{"c":1,"d":2}]},"z":1}');
  });
  it('rejects non-finite numbers rather than silently corrupting the hash', () => {
    expect(() => canonicalize({ x: Infinity })).toThrow(/non-finite/);
  });
  it('excludes proof/commitment metadata from the hash', () => {
    const base = { a: 1 };
    expect(hashSnapshot(base)).toBe(hashSnapshot({ ...base, proof: { content_hash: 'x' } } as any));
    expect(hashable({ ...base, proof: {} })).toEqual(base);
  });
  it('Node and WebCrypto produce the identical 64-char lowercase hex hash', async () => {
    const obj = { schema: 'sentinel.snapshot/1', n: 3.14159, s: 'héllo', nested: { k: true } };
    const node = sha256Hex(canonicalize(obj));
    const browser = await hashSnapshotBrowser(obj);
    expect(browser).toBe(node);
    expect(isValidContentHash(node)).toBe(true);
  });
});

describe('cost model (pure, deterministic)', () => {
  it('is deterministic and matches the published formula by hand', () => {
    const a = costModel(DEFAULT_SCENARIO, LIVE);
    const b = costModel(DEFAULT_SCENARIO, LIVE);
    expect(a).toEqual(b);
    const actions = 10 * 100 * 30 * 0.8; // 24000
    const nearPerAction = 0.3 * 1e12 * 1e8 / 1e24;
    expect(a.actionsPerMonth).toBe(actions);
    expect(a.monthly.gas_usd).toBeCloseTo(actions * nearPerAction * 3.44, 4);
    expect(a.monthly.storage_locked_near).toBeCloseTo(1e6 * 1e19 / 1e24, 5); // 10 NEAR per MB
    expect(a.monthly.total_usd).toBeCloseTo(a.monthly.gas_usd + a.monthly.inference_usd, 5);
    expect(a.cost_per_1000_actions_usd).toBeCloseTo(a.monthly.total_usd / (actions / 1000), 5);
  });
  it('scales linearly with gas price and labels assumptions', () => {
    const lo = costModel(DEFAULT_SCENARIO, LIVE);
    const hi = costModel(DEFAULT_SCENARIO, { ...LIVE, nearGasPriceYocto: '200000000' });
    expect(hi.monthly.gas_usd).toBeCloseTo(lo.monthly.gas_usd * 2, 4);
    expect(hi.assumptions_used.some(s => s.includes('ASSUMPTION'))).toBe(true);
    expect(hi.comparison.map(c => c.chain)).toEqual(['NEAR', 'Base', 'Ethereum', 'Solana']);
  });
  it('storage is locked capital, not added to spent cost', () => {
    const c = costModel(DEFAULT_SCENARIO, LIVE);
    expect(c.monthly.total_usd).toBeCloseTo(c.monthly.gas_usd + c.monthly.inference_usd + c.monthly.infra_usd, 5);
    expect(c.formulas.some(f => f.includes('LOCKED'))).toBe(true);
  });
});

describe('capital flow + health index', () => {
  const inputs: any = {
    blocks: { 'mainnet.latest': 1000, 'mainnet.pinned_12h': 900 },
    prices: { near_usd: 3.44, eth_usd: 3000, sol_usd: 150 },
    cohortBalances: [{ account: 'intents.near', near_yocto: '2000000000000000000000000', near_yocto_pinned: '1000000000000000000000000', wnear_raw: '0', usdc_raw: '0', near_ok: true, ft_ok: true }],
  };
  const cohorts: any = [{ id: 'intents', label: 'Intents', category: 'intents', accounts: ['intents.near'], assets: ['NEAR'] }];
  it('first round uses the pinned-block delta and labels it', () => {
    const cf = capitalFlow(inputs, cohorts, null);
    expect(cf.cohorts[0]!.net_near).toBe(1);
    expect(cf.method).toContain('pinned_block_delta');
    expect(cf.confidence).toContain('baseline');
  });
  it('later rounds use the snapshot-diff fallback', () => {
    const cf = capitalFlow(inputs, cohorts, { snapshot_id: 'prev', params: { cohort_balances: [{ account: 'intents.near', near_yocto: '1500000000000000000000000' }] } });
    expect(cf.cohorts[0]!.net_near).toBeCloseTo(0.5, 6);
    expect(cf.method).toContain('snapshot_diff');
    expect(cf.reference).toBe('snapshot:prev');
  });
  it('health uses fixed bounds and reports low confidence when coverage is low', () => {
    const h = agentHealth({ supply: 1, agents: [{ token_id: '0', account: 'a', balance_near: 1.5, keys: [], owner: 'x' }], commits: [], stale: false });
    expect(h.score).toBeGreaterThanOrEqual(0);
    expect(h.score).toBeLessThanOrEqual(100);
    expect(h.confidence).toBeLessThan(1);
    expect(h.cohorts.find(c => c.id === 'known')!.accounts).toBe(0);
    expect(h.what_this_is_not).toContain('Not a price signal');
    const same = agentHealth({ supply: 1, agents: [{ token_id: '0', account: 'a', balance_near: 1.5, keys: [], owner: 'x' }], commits: [], stale: false });
    expect(h).toEqual(same);
  });
});

describe('dynamic SVG art', () => {
  it('is deterministic, small, self-contained and state-reactive', async () => {
    const a = await sentinelArtSvg('0', 'agent-0.sentinel-body.testnet', { publishes: 3, lastPublishMsAgo: 60000, lowFuel: false });
    const b = await sentinelArtSvg('0', 'agent-0.sentinel-body.testnet', { publishes: 3, lastPublishMsAgo: 60000, lowFuel: false });
    const c = await sentinelArtSvg('1', 'agent-1.sentinel-body.testnet', { publishes: 3, lastPublishMsAgo: 60000, lowFuel: false });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(Buffer.byteLength(a)).toBeLessThan(8192);
    expect(a).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(a).toContain('prefers-reduced-motion');
    expect(a).toContain('<style>');
    expect(a).not.toMatch(/href="https?:\/\/|@import|<image|<script/); // no external resources (xmlns namespace is fine)
  });
  it('dormant and low-fuel states change the art', async () => {
    const dormant = await sentinelArtSvg('0', 'a', { publishes: 0, lastPublishMsAgo: 1e12, lowFuel: false });
    const amber = await sentinelArtSvg('0', 'a', { publishes: 4, lastPublishMsAgo: 1000, lowFuel: true });
    expect(amber).toContain('#FFB547');
    expect(dormant).not.toBe(amber);
  });
});

describe('NEP-413 verification', () => {
  it('verifies a signature produced from the tagged Borsh payload', () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const pubRaw = Buffer.from(publicKey.export({ format: 'jwk' }).x!, 'base64url');
    const pk = 'ed25519:' + b58encode(pubRaw);
    const params = {
      message: 'Sentinel Body vault unlock', nonce: crypto.randomBytes(32),
      recipient: 'sentinel-body.testnet', accountId: 'alice.testnet', publicKey: pk,
    };
    const digest = nep413Digest(params);
    expect(digest.length).toBe(32);
    const signature = crypto.sign(null, digest, privateKey).toString('base64');
    expect(verifyNep413Signature({ ...params, signature })).toEqual({ valid: true });
    const tampered = { ...params, message: 'tampered' };
    expect(verifyNep413Signature({ ...tampered, signature }).valid).toBe(false);
  });
  it('rejects a bad nonce length', () => {
    expect(() => nep413Digest({ message: 'x', nonce: Buffer.alloc(3), recipient: 'r' })).toThrow(/32 bytes/);
  });
});
