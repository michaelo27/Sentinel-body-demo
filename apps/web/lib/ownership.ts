'use client';
import { useCallback, useState } from 'react';
import { useSentinel } from '../app/providers';

export type ProofStage = 'idle' | 'challenge' | 'signing' | 'checking' | 'done' | 'error';
export type ProofResult = { method?: string; tx?: string; explorer_url?: string; error?: string };

/** The exact ownership proof used by the mint and vault flows. */
export function useOwnershipProof() {
  const s = useSentinel();
  const [stage, setStage] = useState<ProofStage>('idle');
  const [result, setResult] = useState<ProofResult>({});

  const prove = useCallback(async (): Promise<ProofResult> => {
    const accountId = s.accountId;
    if (!accountId) { const e = 'Connect a wallet or choose a demo account first.'; setStage('error'); setResult({ error: e }); return { error: e }; }
    setResult({});
    try {
      // ---- No-wallet demo: REAL attest_holder tx signed with a testnet key.
      if (s.mode === 'demo') {
        setStage('challenge');
        const j = await s.api<any>('/api/demo/attest', { method: 'POST', body: JSON.stringify({ accountId }) });
        setStage('checking');
        s.setHolderToken(j.token);
        setStage('done');
        const out = { method: j.method || 'attest_holder', tx: j.tx, explorer_url: j.explorer_url };
        setResult(out); return out;
      }

      // ---- Wallet: NEP-413 off-chain signature when available.
      setStage('challenge');
      const c = await s.api<any>('/auth/challenge', { method: 'POST', auth: false, body: JSON.stringify({ accountId }) });
      if (s.signMessageSupported) {
        setStage('signing');
        const signed = await s.signMessage({ message: c.message, nonce: c.nonce, recipient: c.recipient });
        setStage('checking');
        const v = await fetch('/auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          accountId, publicKey: signed.publicKey, signature: signed.signature, message: signed.message || c.message,
          nonce: c.nonce, recipient: signed.recipient || c.recipient, callbackUrl: signed.callbackUrl,
        }) }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; });
        s.setHolderToken(v.token);
        setStage('done');
        const out = { method: v.method || 'nep413' }; setResult(out); return out;
      }

      // ---- Wallet fallback: attest_holder tx, verified from the wallet receipt.
      setStage('signing');
      const tx = await s.callContract({ methodName: 'attest_holder', args: { nonce: c.nonce }, deposit: '1', gas: '60000000000000' });
      setStage('checking');
      const outcome = tx && typeof tx === 'object' && (tx.transaction || tx.receipts_outcome) ? tx : null;
      if (!outcome) throw new Error('This wallet returned only a transaction hash. Use a wallet with NEP-413 signMessage, or the no-wallet demo proof.');
      const txHash = outcome.transaction?.hash || null;
      const v = await fetch('/api/auth/attest-receipt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId, nonce: c.nonce, txHash, outcome }) })
        .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; });
      s.setHolderToken(v.token);
      setStage('done');
      const out = { method: v.method || 'attest_holder', tx: txHash, explorer_url: txHash ? `https://testnet.nearblocks.io/txns/${txHash}` : undefined };
      setResult(out); return out;
    } catch (e) {
      const out = { error: (e as Error).message };
      setStage('error'); setResult(out); return out;
    }
  }, [s]);

  return { stage, result, prove, reset: () => { setStage('idle'); setResult({}); } };
}
