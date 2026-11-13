/**
 * NEP-413 signMessage verification (server-side).
 * Digest = SHA256( u32_le(2^31+413) || Borsh{message, nonce[32], recipient, callbackUrl?} )
 * The wallet signs that 32-byte digest with a full-access key.
 * Spec: https://github.com/near/NEPs/blob/master/neps/nep-0413.md (verified 2026-11-12).
 */
import crypto from 'node:crypto';
import { b58decode } from './base58.js';

const TAG = 2147484061; // 2^31 + 413

function borshString(s: string): Buffer {
  const b = Buffer.from(s, 'utf8');
  const len = Buffer.alloc(4); len.writeUInt32LE(b.length);
  return Buffer.concat([len, b]);
}

export function nep413Digest(params: { message: string; nonce: Buffer; recipient: string; callbackUrl?: string }): Buffer {
  if (params.nonce.length !== 32) throw new Error('NEP-413 nonce must be exactly 32 bytes');
  if (!params.recipient) throw new Error('NEP-413 recipient must not be empty');
  const tag = Buffer.alloc(4); tag.writeUInt32LE(TAG);
  const payload = Buffer.concat([
    borshString(params.message),
    params.nonce,
    borshString(params.recipient),
    params.callbackUrl ? Buffer.concat([Buffer.from([1]), borshString(params.callbackUrl)]) : Buffer.from([0]),
  ]);
  return crypto.createHash('sha256').update(Buffer.concat([tag, payload])).digest();
}

export function verifyNep413Signature(params: {
  accountId: string; publicKey: string; signature: string;
  message: string; nonce: Buffer; recipient: string; callbackUrl?: string;
}): { valid: boolean; reason?: string } {
  try {
    if (!params.publicKey.startsWith('ed25519:')) return { valid: false, reason: 'only ed25519 keys are supported' };
    const pub = b58decode(params.publicKey.slice(8));
    if (pub.length !== 32) return { valid: false, reason: 'bad public key length' };
    const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), pub]);
    const key = crypto.createPublicKey({ key: spki, format: 'der', type: 'spki' });
    const digest = nep413Digest(params);
    const sig = Buffer.from(params.signature, 'base64');
    if (sig.length !== 64) return { valid: false, reason: 'signature must be 64 bytes' };
    const ok = crypto.verify(null, digest, key, sig);
    return ok ? { valid: true } : { valid: false, reason: 'signature does not match the payload' };
  } catch (e) {
    return { valid: false, reason: String((e as Error).message) };
  }
}
