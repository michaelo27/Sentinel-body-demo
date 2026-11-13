/**
 * Deterministic canonicalization + hashing shared by the runtime, the verify
 * CLI and the browser. RFC 8785 JCS-compatible stable stringify:
 *  - object keys sorted by UTF-16 code unit (JS Array#sort)
 *  - numbers serialized with ECMAScript Number::toString (JSON.stringify)
 *  - no whitespace, undefined object members omitted
 *  - Infinity/NaN rejected instead of silently becoming null
 *
 * This module is BROWSER-SAFE (no node: imports). The same canonicalize()
 * output is hashed with node:crypto in hash-node.ts and with WebCrypto here,
 * so `pnpm verify <id>`, the on-chain content_hash and "Re-verify in browser"
 * always agree.
 */

export function canonicalize(value: unknown): string {
  return serialize(value);
}

function serialize(v: unknown): string {
  if (v === null) return 'null';
  const t = typeof v;
  if (t === 'string') return JSON.stringify(v);
  if (t === 'boolean') return v ? 'true' : 'false';
  if (t === 'number') {
    if (!Number.isFinite(v as number)) throw new Error('canonicalize: non-finite number');
    return JSON.stringify(v);
  }
  if (t === 'bigint') throw new Error('canonicalize: convert bigint to decimal string first');
  if (Array.isArray(v)) return '[' + v.map(serialize).join(',') + ']';
  if (t === 'object') {
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o).filter((k) => o[k] !== undefined).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + serialize(o[k])).join(',') + '}';
  }
  throw new Error(`canonicalize: unsupported value of type ${t}`);
}

/** Proof metadata is attached AFTER the hash is computed; strip it. */
export function hashable(snapshot: unknown): unknown {
  if (snapshot === null || typeof snapshot !== 'object' || Array.isArray(snapshot)) return snapshot;
  const { proof: _p, commitment: _c, ...rest } = snapshot as Record<string, unknown>;
  void _p; void _c;
  return rest;
}

/** Browser/Node-20 WebCrypto hash. Returns 64 lowercase hex chars. */
export async function sha256HexBrowser(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashSnapshotBrowser(snapshot: unknown): Promise<string> {
  return sha256HexBrowser(canonicalize(hashable(snapshot)));
}

export function isValidContentHash(h: string): boolean {
  return /^[0-9a-f]{64}$/.test(h);
}
