/**
 * Hybrid holder auth:
 *  1. NEP-413 signMessage (off-chain, no gas) — Borsh payload + tag 2^31+413,
 *     SHA-256, Ed25519 with a FULL-ACCESS key.
 *  2. Verify the public key actually belongs to the account (view_access_key).
 *  3. Confirm on-chain ownership (is_holder) at request time.
 *  4. Short-lived account-scoped JWT. Holder status is RE-CHECKED (cache <=30s)
 *     on every vault request, so transferring the NFT revokes access quickly.
 *  Fallback: attest_holder(nonce) tx, verified through RPC receipt logs.
 *
 * Short-lived scoped function-call keys derived from ownership are deliberately
 * a non-goal for this MVP (see README).
 */
import crypto from 'node:crypto';
import { RpcPool, verifyNep413Signature } from '@sentinel/core';
import { CFG, deployment } from './config.js';

type Challenge = {
  accountId: string; message: string; nonce: Buffer; nonceB64: string;
  recipient: string; expiresAt: string;
};
const challenges = new Map<string, Challenge>();

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');
export function jwtSign(payload: Record<string, unknown>): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', CFG.jwtSecret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}
export function jwtVerify(token: string): { sub: string; scope: string } | null {
  try {
    const [h, b, s] = token.split('.');
    if (!h || !b || !s) return null;
    const expect = crypto.createHmac('sha256', CFG.jwtSecret).update(`${h}.${b}`).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expect))) return null;
    const payload = JSON.parse(Buffer.from(b, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() / 1000 > Number(payload.exp)) return null;
    return { sub: String(payload.sub), scope: String(payload.scope) };
  } catch { return null; }
}

const holderCache = new Map<string, { at: number; value: boolean }>();
export async function isHolder(accountId: string, pool: RpcPool): Promise<boolean> {
  const hit = holderCache.get(accountId);
  if (hit && Date.now() - hit.at < CFG.holderCacheSeconds * 1000) return hit.value;
  let value = false;
  try { value = Boolean(await pool.viewFunction(deployment().nft_contract_id, 'is_holder', { account_id: accountId })); }
  catch { value = false; }
  holderCache.set(accountId, { at: Date.now(), value });
  return value;
}
export function invalidateHolder(accountId?: string) {
  if (accountId) holderCache.delete(accountId); else holderCache.clear();
}

export function makeChallenge(accountId: string) {
  const nonce = crypto.randomBytes(32);
  const c: Challenge = {
    accountId,
    message: `Unlock the Sentinel Body vault for ${accountId}. This signature does not authorize a transaction or cost gas.`,
    nonce, nonceB64: nonce.toString('base64'),
    recipient: CFG.recipient,
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
  };
  challenges.set(c.nonceB64, c);
  return { message: c.message, nonce: c.nonceB64, recipient: c.recipient, expiresAt: c.expiresAt };
}

export type VerifyInput = {
  accountId: string; publicKey?: string; signature?: string;
  message?: string; nonce?: string; recipient?: string; callbackUrl?: string;
  txHash?: string; // attest_holder fallback
};

export async function verifyChallenge(input: VerifyInput, pool: RpcPool): Promise<{ ok: boolean; token?: string; error?: string; method?: string }> {
  const c = challenges.get(input.nonce || '');
  if (!c) return { ok: false, error: 'Unknown or expired challenge. Request a new one.' };
  if (Date.parse(c.expiresAt) < Date.now()) { challenges.delete(c.nonceB64); return { ok: false, error: 'Challenge expired. Request a new one.' }; }
  if (c.accountId !== input.accountId) return { ok: false, error: 'Challenge was issued for a different account.' };

  if (input.txHash) {
    // ---- Fallback: attest_holder(nonce) transaction ----
    try {
      const r = await pool.call<any>('tx', {
        tx_hash: input.txHash, sender_account_id: input.accountId, wait_until: 'FINAL',
      });
      if (r.transaction?.signer_id !== input.accountId) return { ok: false, error: 'Transaction signer does not match the account.' };
      const failed = r.status?.Failure || r.transaction_outcome?.outcome?.status?.Failure;
      if (failed) return { ok: false, error: 'Attestation transaction failed.' };
      const logs: string[] = (r.receipts_outcome || []).flatMap((x: any) => x.outcome?.logs || []);
      const ok = logs.some((l) => {
        if (!l.startsWith('EVENT_JSON:')) return false;
        try {
          const e = JSON.parse(l.slice(11));
          return e.event === 'holder_attested' && e.data?.[0]?.nonce === c.nonceB64 && e.data?.[0]?.account_id === input.accountId;
        } catch { return false; }
      });
      if (!ok) return { ok: false, error: 'No matching holder_attested event found in that transaction.' };
    } catch (e) {
      return { ok: false, error: `Could not read the attestation tx: ${String((e as Error).message).slice(0, 180)}` };
    }
    challenges.delete(c.nonceB64);
  } else {
    // ---- Primary: NEP-413 off-chain signature ----
    if (!input.publicKey || !input.signature || !input.message || !input.recipient) {
      return { ok: false, error: 'Missing NEP-413 fields. If your wallet lacks signMessage, use the attestation fallback.' };
    }
    if (input.message !== c.message || input.recipient !== c.recipient) {
      return { ok: false, error: 'Signed message or recipient does not match the challenge.' };
    }
    const v = verifyNep413Signature({
      accountId: input.accountId, publicKey: input.publicKey, signature: input.signature,
      message: input.message, nonce: c.nonce, recipient: input.recipient, callbackUrl: input.callbackUrl,
    });
    if (!v.valid) return { ok: false, error: `Invalid signature: ${v.reason}` };
    // The NEP-413 spec requires a full-access key; confirm ownership on-chain.
    try {
      const key = await pool.viewAccessKey(input.accountId, input.publicKey);
      if (key?.permission !== 'FullAccess') return { ok: false, error: 'NEP-413 requires a full-access key on this account.' };
    } catch (e) {
      return { ok: false, error: `Public key is not on this account: ${String((e as Error).message).slice(0, 160)}` };
    }
    challenges.delete(c.nonceB64);
  }

  if (!(await isHolder(input.accountId, pool))) {
    return { ok: false, error: 'This account does not currently hold a Sentinel Body. Mint one to unlock the vault.' };
  }
  invalidateHolder(input.accountId);
  const token = jwtSign({
    sub: input.accountId, scope: 'holder', iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + CFG.jwtTtlSeconds,
  });
  return { ok: true, token, method: input.txHash ? 'attest_holder' : 'nep413' };
}

/**
 * Verify an attest_holder transaction from the receipt returned by
 * broadcast_tx_commit (or by a wallet). This avoids the archival `tx` RPC,
 * which free public providers often time out on. The receipt contains the
 * signer, the status, and the EVENT_JSON logs we need.
 */
export async function verifyAttestation(input: {
  accountId: string; nonce?: string; txHash?: string;
  signerId?: string; failure?: unknown; logs?: string[];
}, pool: RpcPool): Promise<{ ok: boolean; token?: string; error?: string; method?: string }> {
  const c = challenges.get(input.nonce || '');
  if (!c) return { ok: false, error: 'Unknown or expired challenge. Request a new one.' };
  if (Date.parse(c.expiresAt) < Date.now()) { challenges.delete(c.nonceB64); return { ok: false, error: 'Challenge expired. Request a new one.' }; }
  if (c.accountId !== input.accountId) return { ok: false, error: 'Challenge was issued for a different account.' };
  if (input.failure) return { ok: false, error: 'Attestation transaction failed.' };
  if (input.signerId && input.signerId !== input.accountId) return { ok: false, error: 'Transaction signer does not match the account.' };
  const logs: string[] = Array.isArray(input.logs) ? input.logs : [];
  const ok = logs.some((l) => {
    if (!l.startsWith('EVENT_JSON:')) return false;
    try {
      const e = JSON.parse(l.slice(11));
      return e.event === 'holder_attested' && e.data?.[0]?.nonce === c.nonceB64 && e.data?.[0]?.account_id === input.accountId;
    } catch { return false; }
  });
  if (!ok) return { ok: false, error: 'No matching holder_attested event found in the transaction receipt.' };
  challenges.delete(c.nonceB64);
  if (!(await isHolder(input.accountId, pool))) return { ok: false, error: 'This account does not currently hold a Sentinel Body. Mint one to unlock the vault.' };
  invalidateHolder(input.accountId);
  const token = jwtSign({ sub: input.accountId, scope: 'holder', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + CFG.jwtTtlSeconds });
  return { ok: true, token, method: 'attest_holder' };
}

export async function requireHolder(req: { headers: Record<string, any> }, pool: RpcPool) {
  const auth = String(req.headers.authorization || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const jwt = jwtVerify(token);
  if (!jwt || jwt.scope !== 'holder') return { ok: false, error: 'Holder session missing or expired. Prove ownership again.' };
  if (!(await isHolder(jwt.sub, pool))) return { ok: false, error: 'Access revoked: this account no longer holds a Sentinel Body.' };
  return { ok: true, accountId: jwt.sub };
}
