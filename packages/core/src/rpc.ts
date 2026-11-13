/**
 * RPC client with ORDERED FALLBACKS, caching, concurrency limiting and
 * exponential backoff. Fallback order comes from config/rpc.json, verified
 * 2026-11-12 (docs/SOURCES.md). FastNEAR is primary because the Foundation
 * nodes now answer JSON-RPC with a 429 deprecation notice.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './root.js';
const RPC_CONFIG = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'config/rpc.json'), 'utf8'),
) as {
  networks: Record<string, { ordered: { url: string; role: string; status: string; note?: string }[] }>;
  max_concurrency: number;
  backoff_ms: number[];
  user_agent: string;
};

export type Network = 'mainnet' | 'testnet';

export function orderedUrls(network: Network): string[] {
  const override = process.env[`RPC_${network.toUpperCase()}_OVERRIDE`];
  if (override) return override.split(',').map(s => s.trim()).filter(Boolean);
  return RPC_CONFIG.networks[network]!.ordered.map((e) => e.url);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let active = 0;
const waiters: (() => void)[] = [];
async function slot() {
  if (active < RPC_CONFIG.max_concurrency) { active++; return; }
  await new Promise<void>((resolve) => waiters.push(resolve));
  active++;
}
function release() {
  active--;
  const next = waiters.shift();
  if (next) next();
}

const cache = new Map<string, { at: number; value: unknown }>();

export async function politeFetch(url: string, init: RequestInit = {}, cacheMs = 0): Promise<Response> {
  const key = `${init.method || 'GET'}:${url}:${String(init.body || '')}`;
  if (cacheMs > 0) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < cacheMs) return new Response(JSON.stringify(hit.value), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  await slot();
  let lastErr: unknown;
  try {
    for (let attempt = 0; attempt < RPC_CONFIG.backoff_ms.length + 1; attempt++) {
      try {
        const res = await fetch(url, {
          ...init,
          headers: { 'User-Agent': RPC_CONFIG.user_agent, Accept: 'application/json', ...(init.headers || {}) },
          signal: AbortSignal.timeout(15000),
        });
        if (res.status === 429 || res.status >= 500) {
          if (attempt < RPC_CONFIG.backoff_ms.length) { await sleep(RPC_CONFIG.backoff_ms[attempt]!); continue; }
          throw new Error(`HTTP ${res.status} from ${url}`);
        }
        if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
        if (cacheMs > 0) {
          const clone = res.clone();
          cache.set(key, { at: Date.now(), value: await clone.json().catch(() => null) });
        }
        return res;
      } catch (e) {
        lastErr = e;
        if (attempt < RPC_CONFIG.backoff_ms.length) await sleep(RPC_CONFIG.backoff_ms[attempt]!);
      }
    }
    throw lastErr;
  } finally { release(); }
}

export async function politeJson<T = any>(url: string, init: RequestInit = {}, cacheMs = 0): Promise<T> {
  const res = await politeFetch(url, init, cacheMs);
  return (await res.json()) as T;
}

async function post(url: string, body: unknown): Promise<any> {
  const res = await politeFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json: any = await res.json();
  if (json.error) throw new Error(`RPC ${json.error.name || json.error.code}: ${json.error.data || json.error.message}`);
  return json.result;
}

export class RpcPool {
  readonly network: Network;
  readonly urls: string[];
  health: { url: string; live: boolean; height?: number; chainId?: string; error?: string }[] = [];

  constructor(network: Network) { this.network = network; this.urls = orderedUrls(network); }

  async healthCheck() {
    this.health = await Promise.all(this.urls.map(async (url) => {
      try {
        const r = await post(url, { jsonrpc: '2.0', id: 'health', method: 'status', params: [] });
        return { url, live: true, chainId: r.chain_id, height: r.sync_info?.latest_block_height };
      } catch (e) {
        return { url, live: false, error: String((e as Error).message).slice(0, 160) };
      }
    }));
    return this.health;
  }

  /** Try every endpoint in order; a 429/5xx promotes the next one. */
  async call<T = any>(method: string, params: unknown, cacheMs = 0): Promise<T> {
    let lastErr: unknown;
    for (const url of this.urls) {
      try {
        const body = { jsonrpc: '2.0', id: 'sentinel', method, params };
        if (cacheMs > 0) {
          const key = `rpc:${url}:${method}:${JSON.stringify(params)}`;
          const hit = cache.get(key);
          if (hit && Date.now() - hit.at < cacheMs) return hit.value as T;
          const value = await post(url, body);
          cache.set(key, { at: Date.now(), value });
          return value as T;
        }
        return (await post(url, body)) as T;
      } catch (e) { lastErr = e; }
    }
    throw new Error(`all ${this.network} RPC endpoints failed for ${method}: ${String(lastErr)}`);
  }

  async viewAccount(accountId: string, blockId?: number) {
    return this.call<any>('query', {
      request_type: 'view_account', account_id: accountId,
      ...(blockId ? { block_id: blockId } : { finality: 'final' }),
    });
  }

  async viewAccessKey(accountId: string, publicKey: string) {
    return this.call<any>('query', {
      request_type: 'view_access_key', account_id: accountId,
      public_key: publicKey, finality: 'final',
    });
  }

  async viewAccessKeyList(accountId: string) {
    return this.call<any>('query', {
      request_type: 'view_access_key_list', account_id: accountId, finality: 'final',
    });
  }

  async viewFunction<T = any>(contractId: string, methodName: string, args: object = {}) {
    const r = await this.call<any>('query', {
      request_type: 'call_function', account_id: contractId, method_name: methodName,
      args_base64: Buffer.from(JSON.stringify(args)).toString('base64'), finality: 'final',
    });
    const text = Buffer.from(r.result || []).toString('utf8');
    try { return JSON.parse(text) as T; } catch { return text as T; }
  }

  async status() { return this.call<any>('status', [], 10_000); }
}

export const fromYocto = (yocto: string | bigint) => Number(BigInt(yocto)) / 1e24;
export function digest(value: unknown): string {
  // small non-crypto digest for recording what a query returned, so a snapshot
  // pins its inputs without storing megabytes of raw RPC data.
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, '0');
}
