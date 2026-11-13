'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { ArrowLeftRight, Check, X, ExternalLink, RefreshCw, ShieldCheck, History } from 'lucide-react';
import { useSentinel } from '../app/providers';
import { useJson, explorerTx } from '@/lib/api';
import { Card, Chip, shortHash, Skeleton, EmptyState } from './ui';

export function TransferDemo({ compact = false }: { compact?: boolean }) {
  const s = useSentinel();
  const status = useJson<any>('/api/demo/status', { auth: false, intervalMs: 15000 });
  const [busy, setBusy] = useState(false);
  const [tx, setTx] = useState<any>(null);
  const [error, setError] = useState('');
  const admin = status.data?.admin; const second = status.data?.second;
  const owner = status.data?.genesis_token?.owner_id;
  const holders = status.data?.is_holder || {};

  const ensureSession = async (accountId: string) => {
    if (s.accountId === accountId && s.token) return;
    await s.demoSession(accountId);
  };

  const act = async (direction: 'out' | 'back') => {
    setBusy(true); setError(''); setTx(null);
    try {
      if (!owner || !admin || !second) throw new Error('Demo accounts are not available.');
      await ensureSession(direction === 'out' ? admin : second);
      const r = await s.api<any>(`/api/demo/${direction === 'out' ? 'transfer' : 'transfer-back'}`, { method: 'POST', body: JSON.stringify({ tokenId: '0', to: direction === 'out' ? second : admin }) });
      if (!r.success) throw new Error(r.error || 'Transfer failed');
      setTx(r);
      // A transfer should revoke holder sessions for the old owner immediately.
      if (s.accountId === r.from) s.setScope('preview');
      toast.success(`Real nft_transfer confirmed: #0 → ${r.to}`);
      setTimeout(() => status.refresh(), 1200);
    } catch (e) { setError((e as Error).message); toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <Card className={compact ? 'col-12' : 'col-12'} title="Transfer demo · access, authority and history move with the NFT" right={<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><Chip tone="green"><span className="dot dot-live" />REAL TESTNET TX</Chip><button className="btn btn-ghost btn-sm" onClick={status.refresh} aria-label="Refresh on-chain status"><RefreshCw size={13} /></button></div>}>
      {status.loading && !status.data ? <div style={{ display: 'grid', gap: 10 }}><Skeleton h={50} /><Skeleton h={30} /></div> : status.error ? <EmptyState title="Could not read contract" body={status.error} /> : (
        <div className="bento" style={{ gap: 14 }}>
          <div className="col-5">
            <div className="card-title" style={{ marginBottom: 12 }}>Current on-chain state · token #0</div>
            <div className="kv"><span className="kv-k">Owner</span><span className="kv-v" style={{ color: 'var(--green)' }}>{owner || '—'}</span></div>
            <div className="kv"><span className="kv-k">Agent account</span><span className="kv-v">{shortHash(status.data?.genesis_token?.agent_account, 22)}</span></div>
            <div className="kv"><span className="kv-k">Total supply</span><span className="kv-v">{status.data?.total_supply ?? '—'}</span></div>
            <div className="kv"><span className="kv-k">Next token ID</span><span className="kv-v">{status.data?.next_token_id ?? '—'}</span></div>
            <div className="tiny tertiary mono" style={{ marginTop: 10 }}>view call: nft_token · config · nft_total_supply · is_holder</div>
          </div>
          <div className="col-7">
            <div className="card-title" style={{ marginBottom: 12 }}>Holder access · re-checked on-chain (≤30 s cache)</div>
            {[admin, second].filter(Boolean).map((id: string, i: number) => (
              <motion.div key={id} layout className="card-surface" style={{ padding: 14, borderRadius: 12, border: `1px solid ${holders[id] ? 'rgba(0,236,151,.35)' : 'var(--border)'}`, marginBottom: 10, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div><div className="small" style={{ fontWeight: 600 }}>{i === 0 ? 'First account' : 'Second account'}</div><div className="mono tiny tertiary" style={{ marginTop: 4 }}>{id}</div></div>
                <span className={`chip ${holders[id] ? 'chip-green' : 'chip-rose'}`}>{holders[id] ? <Check size={11} /> : <X size={11} />}{holders[id] ? 'ACCESS' : 'NO ACCESS'}</span>
              </motion.div>
            ))}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              <button className="btn btn-primary btn-sm" onClick={() => act('out')} disabled={busy || owner !== admin}><ArrowLeftRight size={14} /> {busy ? 'Signing…' : 'Transfer to second account'}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => act('back')} disabled={busy || owner !== second}>Transfer back</button>
              <Link href="/agent/0" className="btn btn-ghost btn-sm"><History size={13} /> History persists</Link>
            </div>
            {owner !== admin && owner !== second && <p className="tiny tertiary" style={{ marginTop: 10 }}>Genesis is currently owned by a third account. Only that account can initiate its transfer; use a wallet for that path.</p>}
            {tx && <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}><Chip tone="green"><Check size={11} /> nft_transfer CONFIRMED</Chip><span className="mono tiny">{shortHash(tx.tx, 14)}</span><a href={tx.explorer_url || explorerTx(tx.tx)} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm"><ExternalLink size={12} /> Explorer</a></div>}
            {error && <p className="small" style={{ color: 'var(--rose)', marginTop: 10 }} role="alert">{error}</p>}
            <p className="tiny tertiary" style={{ lineHeight: 1.6, marginTop: 14, marginBottom: 0 }}>After the transfer, the first account&apos;s holder JWT is rejected by the next vault request because <span className="mono">is_holder</span> is re-checked on-chain. The second account can prove ownership and unlock the same vault, with all previous commitments intact.</p>
          </div>
        </div>
      )}
    </Card>
  );
}
