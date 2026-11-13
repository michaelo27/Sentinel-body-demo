'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { canonicalize, hashable, hashSnapshotBrowser } from '@sentinel/core/canonical';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, ShieldCheck, RefreshCw, ExternalLink, Terminal, Layers, Hash as HashIcon, Link2 } from 'lucide-react';
import { Card, Chip, CopyButton, HashRow, shortHash, absoluteTime } from './ui';
import { useJson, explorerTx } from '@/lib/api';
import { useSentinel } from '../app/providers';

type VerifyState = 'idle' | 'fetching' | 'canonical' | 'hashing' | 'chain' | 'done' | 'failed';

const STEPS: { key: VerifyState; title: string; detail: string }[] = [
  { key: 'fetching', title: 'Fetch full snapshot', detail: 'from the released vault record (after public delay) or holder vault' },
  { key: 'canonical', title: 'Canonicalize (RFC 8785 JCS)', detail: 'sorted keys, no whitespace, deterministic number encoding' },
  { key: 'hashing', title: 'SHA-256 in this browser', detail: 'window.crypto.subtle.digest — no server trust required' },
  { key: 'chain', title: 'Read on-chain commitment', detail: 'view call to sntl-02e90eacb8.testnet on NEAR testnet' },
  { key: 'done', title: 'Compare byte-for-byte', detail: 'local hash === contract content_hash === published hash' },
];

export function ProofPanel({ snapshotId, fullSnapshot, commitment }: { snapshotId?: string | null; fullSnapshot?: any; commitment?: any }) {
  const { api } = useSentinel();
  const [state, setState] = useState<VerifyState>('idle');
  const [localHash, setLocalHash] = useState<string | null>(null);
  const [chainHash, setChainHash] = useState<string | null>(commitment?.content_hash || null);
  const [canonical, setCanonical] = useState<string | null>(null);
  const [bytes, setBytes] = useState(0);
  const [error, setError] = useState('');
  const [source, setSource] = useState('');
  const [tx, setTx] = useState<string | null>(fullSnapshot?.proof?.commitment_tx || commitment?.commitment_tx || null);
  const chain = useJson<any>(snapshotId ? `/api/public/verify?q=${encodeURIComponent(snapshotId)}` : null, { auth: false, intervalMs: 0 });

  useEffect(() => {
    if (commitment?.content_hash) setChainHash(commitment.content_hash);
    if (fullSnapshot?.proof?.commitment_tx) setTx(fullSnapshot.proof.commitment_tx);
  }, [commitment?.content_hash, fullSnapshot?.proof?.commitment_tx]);

  const verify = useCallback(async () => {
    setError(''); setLocalHash(null); setCanonical(null); setSource('');
    try {
      setState('fetching');
      let snap = fullSnapshot;
      let src = fullSnapshot ? 'holder vault (in-memory)' : '';
      if (!snap && snapshotId) {
        try {
          const r = await api<any>(`/api/snapshot/${encodeURIComponent(snapshotId)}`, { auth: true });
          snap = r.snapshot; src = 'holder vault API';
        } catch {
          const r = await fetch(`/api/public/snapshot/${encodeURIComponent(snapshotId)}?full=1`).then(async (res) => { const j = await res.json(); if (!res.ok) throw new Error(j.error); return j; });
          snap = r.snapshot; src = 'public delayed full snapshot';
        }
      }
      if (!snap) throw new Error('No snapshot available to verify.');
      const published = snap.proof?.content_hash || null;
      setSource(`${src} · ${snap.snapshot_id}`);

      await new Promise((r) => setTimeout(r, 260));
      setState('canonical');
      const c = canonicalize(hashable(snap));
      setCanonical(c); setBytes(new TextEncoder().encode(c).length);
      await new Promise((r) => setTimeout(r, 340));

      setState('hashing');
      const h = await hashSnapshotBrowser(snap);
      setLocalHash(h);
      await new Promise((r) => setTimeout(r, 300));

      setState('chain');
      let onChain = chainHash;
      if (snap.snapshot_id) {
        const p = await fetch(`/api/public/verify?q=${encodeURIComponent(snap.snapshot_id)}`).then((res) => res.json()).catch(() => null);
        if (p?.commitment?.content_hash) onChain = p.commitment.content_hash;
        if (p?.commitment?.commitment_tx) setTx(p.commitment.commitment_tx);
      }
      if (!onChain) {
        const c2 = await fetch('/api/public/commitment').then((res) => res.json()).catch(() => null);
        if (c2?.commitment?.content_hash) onChain = c2.commitment.content_hash;
      }
      setChainHash(onChain);
      await new Promise((r) => setTimeout(r, 260));

      const ok = !!onChain && h === onChain && (!published || h === published);
      setState(ok ? 'done' : 'failed');
      if (!ok) setError(onChain ? `MISMATCH: browser ${h.slice(0, 12)}… vs chain ${onChain.slice(0, 12)}…` : 'Could not read the on-chain commitment.');
    } catch (e) {
      setState('failed'); setError((e as Error).message);
    }
  }, [api, chainHash, fullSnapshot, snapshotId]);

  const cur = STEPS.findIndex((s) => s.key === state);
  const done = state === 'done';
  const failed = state === 'failed';

  return (
    <Card className="col-12" style={{ padding: 26 }} title="Proof panel · verify without trusting the server">
      <div className="bento" style={{ gap: 16 }}>
        <div className="col-5">
          <p className="small muted" style={{ lineHeight: 1.65, marginTop: 0 }}>
            Every snapshot is a deterministic JSON document. The agent hashes its canonical form and a restricted function-call key commits that hash to the NEAR testnet contract. Anyone can recompute the hash and read the commitment back.
          </p>
          <HashRow label="Snapshot ID" value={snapshotId || null} />
          <HashRow label="Browser SHA-256" value={localHash} />
          <HashRow label="On-chain hash" value={chainHash} />
          <HashRow label="Commitment tx" value={tx} href={tx ? explorerTx(tx) : undefined} />
          {commitment?.block_heights && Object.entries(commitment.block_heights).map(([k, v]: any) => <div className="kv" key={k}><span className="kv-k">Pinned {k}</span><span className="kv-v">{Number(v).toLocaleString()}</span></div>)}
          <div className="kv"><span className="kv-k">Methodology</span><span className="kv-v">{commitment?.methodology_version || 'v1'}</span></div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
            <button className="btn btn-primary" onClick={verify} disabled={state !== 'idle' && state !== 'done' && state !== 'failed'}>
              {state === 'idle' || done || failed ? <><ShieldCheck size={16} /> Re-verify in browser</> : <><RefreshCw size={15} className="animate-spin" /> Verifying…</>}
            </button>
            <a className="btn btn-ghost" href={snapshotId ? `/verify?q=${encodeURIComponent(snapshotId)}` : '/verify'}><Terminal size={15} /> Open verifier</a>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
            <Chip>CLI: pnpm verify {snapshotId || '<id>'}</Chip>
            {source && <Chip>{source}</Chip>}
          </div>
        </div>

        <div className="col-7">
          <div className="card-surface" style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span className="card-title">Hash cascade</span>
              <span className={`chip ${done ? 'chip-green' : failed ? 'chip-rose' : 'chip-violet'}`}>{done ? '✓ MATCH' : failed ? '✕ MISMATCH' : state === 'idle' ? 'READY' : state.toUpperCase()}</span>
            </div>
            {STEPS.map((s, i) => {
              const active = state === s.key;
              const complete = cur > i || done;
              return (
                <div key={s.key} style={{ display: 'flex', gap: 12, position: 'relative', paddingBottom: 14 }}>
                  {i < STEPS.length - 1 && <span className="step-line" style={{ left: 11, top: 24, bottom: 0 }} />}
                  <span style={{ flex: '0 0 24px', height: 24, borderRadius: 7, display: 'grid', placeItems: 'center', zIndex: 1, background: complete ? 'rgba(0,236,151,.12)' : active ? 'rgba(139,124,255,.16)' : 'var(--surface-2)', border: `1px solid ${complete ? 'rgba(0,236,151,.4)' : active ? 'rgba(139,124,255,.4)' : 'var(--border)'}` }}>
                    {complete ? <Check size={13} color="var(--green)" /> : <span className="mono tiny" style={{ color: active ? 'var(--violet)' : 'var(--text-3)' }}>{i + 1}</span>}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="small" style={{ color: complete || active ? 'var(--text)' : 'var(--text-3)', fontWeight: 550 }}>{s.title}</div>
                    <div className="tiny tertiary" style={{ marginTop: 2 }}>{s.detail}</div>
                    {active && <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: .6 }} style={{ height: 2, background: 'var(--violet)', marginTop: 8 }} />}
                    {s.key === 'hashing' && localHash && <div className="hash" style={{ marginTop: 7 }}>{localHash}</div>}
                    {s.key === 'canonical' && canonical && <div className="tiny tertiary mono" style={{ marginTop: 7 }}>{bytes.toLocaleString()} UTF-8 bytes · first 64 chars: {canonical.slice(0, 64)}…</div>}
                  </div>
                </div>
              );
            })}
            <AnimatePresence>
              {(done || failed) && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="chip" style={{ height: 'auto', padding: '10px 12px', borderColor: done ? 'rgba(0,236,151,.35)' : 'rgba(255,92,122,.35)', color: done ? 'var(--green)' : 'var(--rose)', whiteSpace: 'normal', lineHeight: 1.5 }}>
                  {done ? '✓ MATCH — the bytes you hashed in this browser are exactly the bytes the agent committed on-chain.' : `Verification failed: ${error}`}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {chain.data?.found !== undefined && <div className="tiny tertiary mono" style={{ marginTop: 10 }}>server-side check: {chain.data.found ? `found (${chain.data.source}) · matches=${String(chain.data.matches)}` : chain.data.error}</div>}
        </div>
      </div>
    </Card>
  );
}

export function CommitmentStrip({ commitment }: { commitment: any }) {
  return (
    <div className="card" style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', padding: '16px 20px' }}>
      <span className="chip chip-green"><span className="dot dot-live" />ON-CHAIN COMMITMENT PUBLIC</span>
      <span className="small muted">Latest hash</span>
      <span className="hash">{commitment?.content_hash || '—'}</span>
      {commitment?.content_hash && <CopyButton value={commitment.content_hash} />}
      <span className="small tertiary divider-dot">block {commitment?.block_height?.toLocaleString() || '—'}</span>
      {commitment?.explorer_url && <a href={commitment.explorer_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm"><ExternalLink size={13} /> Explorer</a>}
    </div>
  );
}
