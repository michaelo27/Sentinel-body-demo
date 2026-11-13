/** Single place for env + verified deployment metadata. */
import fs from 'node:fs';
import path from 'node:path';

export const ROOT: string = (() => { let d = process.cwd(); for (let i = 0; i < 5; i++) { if (fs.existsSync(path.join(d, 'config/rpc.json'))) return d; d = path.dirname(d); } return process.cwd(); })();
export const DATA_DIR = path.join(ROOT, 'data/snapshots');
export const KEY_DIR = path.join(ROOT, 'keys');

function env(k: string, d: string) { return process.env[k] ?? d; }

export const CFG = {
  port: Number(env('PORT', '8787')),
  host: '0.0.0.0',
  settledNetwork: 'testnet' as const,
  dataNetwork: (env('DATA_NETWORK', 'mainnet') === 'testnet' ? 'testnet' : 'mainnet') as 'mainnet' | 'testnet',
  publicDelayMinutes: Number(env('PUBLIC_DELAY_MINUTES', '15')),
  jwtSecret: env('JWT_SECRET', 'dev-only-change-me-32-byte-secret!!'),
  jwtTtlSeconds: Number(env('JWT_TTL_SECONDS', '600')),
  holderCacheSeconds: Number(env('HOLDER_CACHE_SECONDS', '30')),
  roundIntervalMinutes: Number(env('ROUND_INTERVAL_MINUTES', '30')),
  demoReplay: env('DEMO_REPLAY', '0') === '1',
  runtimeVersion: env('RUNTIME_VERSION', '0.1.0'),
  recipient: env('NEP413_RECIPIENT', 'sntl-02e90eacb8.testnet'),
  adminToken: env('ADMIN_TOKEN', ''),
  demoMode: env('DEMO_MODE', '1') === '1',
  gatewayBase: env('GATEWAY_PUBLIC_URL', 'http://localhost:8787'),
};

export type Deployment = {
  network: string; status: string; nft_contract_id: string; admin_account_id: string;
  genesis_agent_account: string | null; genesis_worker_public_key: string;
  gateway_url?: string; deployed_contract?: any; genesis_mint_tx?: string | null;
  explorer?: string;
};

export function deployment(): Deployment {
  const p = path.join(ROOT, 'deployments/testnet.json');
  if (!fs.existsSync(p)) throw new Error('deployments/testnet.json missing — run node scripts/create-account.mjs && pnpm deploy');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function keystore(): any {
  const p = path.join(KEY_DIR, 'testnet.json');
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

export function cohorts(): any {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'config/cohorts.json'), 'utf8'));
}
export function methodology(): any {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'config/methodology.v1.json'), 'utf8'));
}
export function assumptions(): any {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'config/assumptions.json'), 'utf8'));
}
export function agentSignals(): any {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'config/agent-signals.json'), 'utf8'));
}
export function sources(): any {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'config/sources.json'), 'utf8'));
}
