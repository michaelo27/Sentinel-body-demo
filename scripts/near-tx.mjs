/**
 * Tiny dependency-free NEAR transaction toolkit (Node >= 20).
 *
 * Why: the deploy/runtime path must work with zero npm installs, so it can run
 * from a clean checkout in CI or on a free container host. It implements the
 * Borsh encoding of `Transaction` / `Action` / `AccessKey` and signs with the
 * built-in Ed25519 support in node:crypto.
 *
 * Verified against real testnet RPCs on 2026-11-12 (docs/SOURCES.md).
 * Do not use for anything beyond this demo; it is deliberately minimal.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function b58encode(bytes) {
  let n = BigInt('0x' + Buffer.from(bytes).toString('hex'));
  let out = '';
  while (n > 0n) { out = B58[Number(n % 58n)] + out; n /= 58n; }
  for (const b of bytes) { if (b === 0) out = '1' + out; else break; }
  return out;
}

export function b58decode(str) {
  let n = 0n;
  for (const c of str) {
    const i = B58.indexOf(c);
    if (i < 0) throw new Error(`invalid base58 char ${c}`);
    n = n * 58n + BigInt(i);
  }
  let hex = n.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  const bytes = Buffer.from(hex, 'hex');
  const leading = [...str].findIndex(c => c !== '1');
  const pad = leading < 0 ? str.length : leading;
  return Buffer.concat([Buffer.alloc(pad), bytes]);
}

export function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pubJwk = publicKey.export({ format: 'jwk' });
  const privJwk = privateKey.export({ format: 'jwk' });
  const pub = Buffer.from(pubJwk.x, 'base64url');
  const seed = Buffer.from(privJwk.d, 'base64url');
  return {
    publicKey: 'ed25519:' + b58encode(pub),
    privateKey: 'ed25519:' + b58encode(Buffer.concat([seed, pub])),
    rawPublic: pub,
  };
}

export function privateKeyBytes(secret) {
  const b = b58decode(String(secret).replace(/^ed25519:/, ''));
  if (b.length !== 64) throw new Error('private key must be 64 bytes (seed||pub)');
  return b.subarray(0, 32);
}
export function publicKeyBytes(pk) {
  const b = b58decode(String(pk).replace(/^ed25519:/, ''));
  if (b.length !== 32) throw new Error('public key must be 32 bytes');
  return b;
}
function privateKeyObject(secret) {
  const der = Buffer.concat([
    Buffer.from('302e020100300506032b657004220420', 'hex'),
    privateKeyBytes(secret),
  ]);
  return crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
}

// ---------------------------------------------------------------- Borsh writer
class W {
  constructor() { this.parts = []; }
  u8(n) { const b = Buffer.alloc(1); b.writeUInt8(n); this.parts.push(b); return this; }
  u32(n) { const b = Buffer.alloc(4); b.writeUInt32LE(n); this.parts.push(b); return this; }
  u64(n) { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); this.parts.push(b); return this; }
  u128(n) { const b = Buffer.alloc(16); b.writeBigUInt64LE(BigInt(n) & ((1n << 64n) - 1n), 0); b.writeBigUInt64LE(BigInt(n) >> 64n, 8); this.parts.push(b); return this; }
  raw(b) { this.parts.push(Buffer.from(b)); return this; }
  str(s) { const b = Buffer.from(String(s), 'utf8'); return this.u32(b.length).raw(b); }
  vec(items, fn) { this.u32(items.length); for (const i of items) fn(this, i); return this; }
  bytes() { return Buffer.concat(this.parts); }
}
const pubKey = (w, pk) => w.u8(0).raw(publicKeyBytes(pk));
const optU128 = (w, v) => { if (v === null || v === undefined) w.u8(0); else w.u8(1).u128(v); };

/** Action builders (Borsh enum indices from near-primitives). */
export const A = {
  createAccount: () => ({ kind: 'createAccount' }),
  transfer: (yocto) => ({ kind: 'transfer', yocto: BigInt(yocto) }),
  deployContract: (code) => ({ kind: 'deployContract', code: Buffer.from(code) }),
  functionCall: (methodName, args, gasTgas = 30, yocto = 0n) => ({
    kind: 'functionCall', methodName,
    args: Buffer.from(typeof args === 'string' ? args : JSON.stringify(args), 'utf8'),
    gas: BigInt(gasTgas) * 1_000_000_000_000n, yocto: BigInt(yocto),
  }),
  addKey: (publicKey, { fullAccess = false, allowance = null, receiverId = '', methodNames = [] } = {}) =>
    ({ kind: 'addKey', publicKey, fullAccess, allowance, receiverId, methodNames }),
  deleteKey: (publicKey) => ({ kind: 'deleteKey', publicKey }),
};

function encodeActions(actions) {
  const w = new W();
  w.u32(actions.length);
  for (const a of actions) {
    switch (a.kind) {
      case 'createAccount': w.u8(0); break;
      case 'deployContract': w.u8(1); w.u32(a.code.length).raw(a.code); break;
      case 'functionCall': w.u8(2); w.str(a.methodName); w.u32(a.args.length).raw(a.args); w.u64(a.gas); w.u128(a.yocto); break;
      case 'transfer': w.u8(3); w.u128(a.yocto); break;
      case 'addKey': {
        w.u8(5); pubKey(w, a.publicKey);
        w.u64(0); // access key nonce
        if (a.fullAccess) w.u8(0);
        else {
          w.u8(1); optU128(w, a.allowance);
          w.str(a.receiverId);
          w.vec(a.methodNames, (ww, m) => ww.str(m));
        }
        break;
      }
      case 'deleteKey': w.u8(6); pubKey(w, a.publicKey); break;
      default: throw new Error(`unsupported action ${a.kind}`);
    }
  }
  return w.bytes();
}

export function encodeTransaction({ signerId, publicKey, nonce, receiverId, blockHash, actions }) {
  const w = new W();
  w.str(signerId);
  pubKey(w, publicKey);
  w.u64(nonce);
  w.str(receiverId);
  w.raw(b58decode(blockHash));
  w.raw(encodeActions(actions));
  return w.bytes();
}

export function signTransaction(txBytes, privateKey) {
  const digest = crypto.createHash('sha256').update(txBytes).digest();
  const sig = crypto.sign(null, digest, privateKeyObject(privateKey));
  return Buffer.concat([txBytes, Buffer.from([0]), sig]);
}

// ------------------------------------------------------------------- RPC layer
export async function rpcCall(url, method, params, { timeout = 20000 } = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'SentinelBody/0.1' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'sentinel', method, params }),
    signal: AbortSignal.timeout(timeout),
  });
  const json = await res.json();
  if (!res.ok && !json.error) throw new Error(`${method} HTTP ${res.status}`);
  return json;
}

export async function rpcQuery(url, params) {
  const j = await rpcCall(url, 'query', params);
  if (j.error) throw new Error(`RPC ${j.error.name || j.error.code}: ${j.error.data || j.error.message}`);
  return j.result;
}

export async function viewAccount(url, accountId) {
  return rpcQuery(url, { request_type: 'view_account', account_id: accountId, finality: 'final' });
}

export async function viewAccessKey(url, accountId, publicKey) {
  return rpcQuery(url, { request_type: 'view_access_key', account_id: accountId, public_key: publicKey, finality: 'final' });
}

export async function viewAccessKeyList(url, accountId) {
  return rpcQuery(url, { request_type: 'view_access_key_list', account_id: accountId, finality: 'final' });
}

/** Contract view call via the RPC `call_function` query. Returns parsed JSON. */
export async function viewFunction(url, contractId, methodName, args = {}) {
  const r = await rpcQuery(url, {
    request_type: 'call_function', account_id: contractId, method_name: methodName,
    args_base64: Buffer.from(JSON.stringify(args)).toString('base64'), finality: 'final',
  });
  const bytes = Buffer.from(r.result || []);
  if (!bytes.length) return null;
  try { return JSON.parse(bytes.toString('utf8')); } catch { return bytes.toString('utf8'); }
}

/** Read a single tx (used for the attest_holder fallback and explorer links). */
export async function txStatus(url, txHash, senderAccountId) {
  const j = await rpcCall(url, 'tx', { tx_hash: txHash, sender_account_id: senderAccountId, wait_until: 'FINAL' });
  if (j.error) throw new Error(`tx ${j.error.data || j.error.message}`);
  return j.result;
}

/**
 * Sign + broadcast one transaction. Uses ordered RPC fallbacks for the
 * read-only parts; broadcasts to the first healthy endpoint with retries.
 */
export async function signAndSend({ urls, signerId, privateKey, publicKey, receiverId, actions, nonce }) {
  const errors = [];
  for (const endpoint of (Array.isArray(urls) ? urls : [urls])) {
    let broadcastAttempted = false;
    try {
      const status = (await rpcCall(endpoint, 'status', [])).result;
      if (!status?.sync_info) throw new Error('bad status response');
      const key = await viewAccessKey(endpoint, signerId, publicKey);
      const useNonce = BigInt(nonce ?? key.nonce) + 1n;
      const txBytes = encodeTransaction({
        signerId, publicKey, nonce: useNonce, receiverId,
        blockHash: status.sync_info.latest_block_hash, actions,
      });
      const signed = signTransaction(txBytes, privateKey);
      const hash = crypto.createHash('sha256').update(txBytes).digest();
      const txHash = b58encode(hash);
      broadcastAttempted = true;
      const r = await rpcCall(endpoint, 'broadcast_tx_commit', {
        signed_tx_base64: signed.toString('base64'),
      });
      if (r.error) throw new Error(`broadcast: ${JSON.stringify(r.error).slice(0, 300)}`);
      const out = r.result || {};
      if (!out.status || (!('SuccessValue' in out.status) && !('Failure' in out.status))) {
        throw new Error('RPC did not return a final execution status; inspect chain state before retrying');
      }
      const failure = out.status?.Failure
        || out.transaction_outcome?.outcome?.status?.Failure
        || (out.receipts_outcome || []).map((x) => x.outcome?.status?.Failure).find(Boolean);
      return {
        txHash, endpoint, result: out,
        success: !failure,
        failure,
        explorerUrl: `https://testnet.nearblocks.io/txns/${txHash}`,
        logs: (out.receipts_outcome || []).flatMap(x => x.outcome?.logs || []),
      };
    } catch (e) {
      if (broadcastAttempted) throw new Error(`Broadcast outcome requires inspection; NOT retrying with a new nonce: ${String(e.message || e)}`);
      errors.push(`${endpoint}: ${String((e && e.message) || e).slice(0, 220)}`);
    }
  }
  throw new Error(`signAndSend failed on all endpoints: ${errors.join(' | ')}`);
}

// --------------------------------------------------------------------- keystore
export function readKeystore(dir) {
  const p = path.resolve(dir, 'testnet.json');
  if (!fs.existsSync(p)) throw new Error(`keystore missing: ${p} (run scripts/create-account.mjs)`);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
export function writeKeystore(dir, data) {
  const p = path.resolve(dir, 'testnet.json');
  fs.mkdirSync(path.dirname(p), { recursive: true, mode: 0o700 });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), { mode: 0o600 });
  return p;
}

export const NEAR = 1_000_000_000_000_000_000_000_000n;
export const toYocto = (near) => BigInt(Math.round(Number(near) * 1e6)) * 1_000_000_000_000_000_000n;
