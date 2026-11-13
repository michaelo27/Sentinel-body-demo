import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { makeChallenge, verifyChallenge, jwtSign, jwtVerify } from '../src/auth.js';
import { b58encode } from '@sentinel/core';

const fakePool = {
  viewAccessKey: async () => ({ permission: 'FullAccess' }),
  viewFunction: async (_c: string, m: string) => m === 'is_holder',
  call: async () => ({}),
} as any;

describe('auth: JWT + NEP-413 challenge', () => {
  it('issues a 32-byte nonce and a scoped, expiring token', () => {
    const c = makeChallenge('alice.testnet');
    expect(Buffer.from(c.nonce, 'base64').length).toBe(32);
    expect(c.message).toContain('alice.testnet');
    const token = jwtSign({ sub: 'alice.testnet', scope: 'holder', exp: Math.floor(Date.now() / 1000) + 60 });
    expect(jwtVerify(token)).toEqual({ sub: 'alice.testnet', scope: 'holder' });
  });
  it('rejects tampered and expired tokens', () => {
    const token = jwtSign({ sub: 'alice.testnet', scope: 'holder', exp: Math.floor(Date.now() / 1000) - 1 });
    expect(jwtVerify(token)).toBeNull();
    expect(jwtVerify(token.slice(0, -2) + 'xy')).toBeNull();
    expect(jwtVerify('not.a.jwt')).toBeNull();
  });
  it('rejects a signature over the wrong message', async () => {
    const c = makeChallenge('alice.testnet');
    const r = await verifyChallenge({
      accountId: 'alice.testnet', nonce: c.nonce, recipient: c.recipient,
      message: 'a different message', publicKey: 'ed25519:invalid', signature: 'AAAA',
    }, fakePool);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/does not match/);
  });
  it('accepts a correctly signed NEP-413 payload from a real full-access key', async () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const pub = Buffer.from(publicKey.export({ format: 'jwk' }).x!, 'base64url');
    const pk = 'ed25519:' + b58encode(pub);
    const c = makeChallenge('bob.testnet');
    // build the tagged Borsh payload exactly as NEP-413 specifies
    const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
    const str = (s: string) => { const b = Buffer.from(s); return Buffer.concat([u32(b.length), b]); };
    const digest = crypto.createHash('sha256').update(Buffer.concat([
      u32(2147484061), str(c.message), Buffer.from(c.nonce, 'base64'), str(c.recipient), Buffer.from([0]),
    ])).digest();
    const signature = crypto.sign(null, digest, privateKey).toString('base64');
    const r = await verifyChallenge({
      accountId: 'bob.testnet', nonce: c.nonce, recipient: c.recipient, message: c.message,
      publicKey: pk, signature,
    }, fakePool);
    expect(r.ok).toBe(true);
    expect(r.method).toBe('nep413');
    expect(jwtVerify(r.token!)?.sub).toBe('bob.testnet');
  });
  it('rejects an unknown challenge', async () => {
    const r = await verifyChallenge({ accountId: 'x.testnet', nonce: 'made-up' }, fakePool);
    expect(r.error).toMatch(/Unknown or expired/);
  });
});

describe('vault store', () => {
  it('saves and retrieves a snapshot, and enforces the public delay', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sentinel-store-'));
    const { VaultStore } = await import('../src/store.js');
    const s = new VaultStore(tmp);
    const id = `test-${Date.now()}`;
    const snapshot: any = {
      schema: 'sentinel.snapshot/1', snapshot_id: id, epoch_ts: new Date().toISOString(),
      methodology_version: 'v1', observed_network: 'mainnet', settled_network: 'testnet',
      inputs: { blocks: {}, queries: [], prices: {}, gas: {}, params: {} },
      capital_flow: {}, cost_of_living: {}, agent_health: {},
      meta: { agent_token_id: '0', agent_account: 'a', runtime_version: 'test', mode: 'live', stale: false, notes: [] },
      proof: { content_hash: 'a'.repeat(64), commitment_tx: null },
    };
    s.save(snapshot);
    expect(s.get(id)?.snapshot_id).toBe(id);
    expect(s.latest()?.snapshot_id).toBe(id);
    expect(s.delayed(15)).toBeNull(); // fresh snapshot is still inside the delay
    expect(s.isPublic(id, 0)).toBe(true);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
