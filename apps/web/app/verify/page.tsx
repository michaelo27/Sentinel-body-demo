'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, ShieldCheck, ExternalLink, ArrowRight, Terminal, Check, X } from 'lucide-react';
import { ProofPanel } from '@/components/proof-panel';
import { Card, Chip, HashRow, Badge, shortHash, EmptyState, Skeleton } from '@/components/ui';
import { useJson, explorerTx } from '@/lib/api';

export default function VerifyPage() {
  const [q, setQ] = useState('');
  const [submitted, setSubmitted] = useState('');
  const list = useJson<any>('/api/public/commitments', { auth: false, intervalMs: 60000 });
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('q');
    if (p) { setQ(p); setSubmitted(p); }
    else if (list.data?.items?.length) {
      const first = list.data.items.find((x: any) => x.public_after_delay) || list.data.items[0];
      setQ(first.id); setSubmitted(first.id);
    }
  }, [list.data?.items?.length]);
  const result = useJson<any>(submitted ? `/api/public/verify?q=${encodeURIComponent(submitted)}` : null, { auth: false, intervalMs: 0 });
  const c = result.data?.commitment;
  const snapshotId = c?.id || (result.data?.vault_snapshot?.snapshot_id) || (result.data?.found ? submitted : null);
  const heights = typeof c?.observed_block_heights === 'string' ? (() => { try { return JSON.parse(c.observed_block_heights); } catch { return {}; } })() : (c?.observed_block_heights || {});

  return (
    <div className="wrap" style={{ paddingTop: 48, paddingBottom: 40 }}>
      <span className="eyebrow">Public verifier</span>
      <h1 className="h2" style={{ marginTop: 10 }}>Verify a snapshot or a hash.</h1>
      <p className="lead" style={{ maxWidth: 680, marginTop: 12 }}>Paste a snapshot ID or a 64-character content hash. The contract commitment is public immediately; the full-resolution snapshot becomes public after the delay so the hash can be recomputed locally.</p>

      <Card style={{ marginTop: 26, padding: 20 }}>
        <form onSubmit={(e) => { e.preventDefault(); if (q.trim() === submitted) { void result.refresh(); } else { setSubmitted(q.trim()); } }} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
            <Search size={16} style={{ position: 'absolute', left: 13, top: 14, color: 'var(--text-3)' }} />
            <input className="input" style={{ paddingLeft: 38 }} placeholder="snap-… or 64-char content hash" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Snapshot ID or content hash" />
          </div>
          <button className="btn btn-primary" type="submit" disabled={!q.trim()}><ShieldCheck size={16} /> Verify</button>
        </form>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          <span className="tiny tertiary">Recent on-chain commitments:</span>
          {(list.data?.items || []).slice(0, 3).map((x: any) => <button key={x.id} className="btn btn-ghost btn-sm" onClick={() => { setQ(x.id); setSubmitted(x.id); }}>{shortHash(x.id, 14)}</button>)}
        </div>
      </Card>

      <div className="bento" style={{ marginTop: 16, rowGap: 16 }}>
        <Card className="col-5" title="Server-side lookup (untrusted convenience)">
          {result.loading && !result.data ? <div style={{ display: 'grid', gap: 10 }}><Skeleton h={24} /><Skeleton h={24} /><Skeleton h={24} /></div> : result.data?.found ? <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}><Chip tone={result.data.matches ? 'green' : 'violet'}>{result.data.matches ? <Check size={11} /> : null}{result.data.matches ? 'SERVER HASH MATCH' : 'COMMITMENT FOUND'}</Chip><Chip>{result.data.source}</Chip></div>
            <HashRow label="Snapshot ID" value={c?.id || snapshotId || null} />
            <HashRow label="Content hash" value={c?.content_hash || null} />
            <HashRow label="Publisher" value={c?.agent_account || null} href={c?.agent_account ? `https://testnet.nearblocks.io/accounts/${c.agent_account}` : undefined} />
            {result.data.recomputed_hash && <HashRow label="Vault recompute" value={result.data.recomputed_hash} />}
            <div className="kv"><span className="kv-k">Block</span><span className="kv-v">{c?.block_height?.toLocaleString() || '—'}</span></div>
            <div className="kv"><span className="kv-k">Methodology</span><span className="kv-v">{c?.methodology_version || '—'}</span></div>
            {Object.entries(heights).map(([k, v]: any) => <div className="kv" key={k}><span className="kv-k">{k}</span><span className="kv-v">{Number(v).toLocaleString()}</span></div>)}
            <div className="kv"><span className="kv-k">Full data public</span><span className="kv-v">{String(result.data.public_after_delay)}</span></div>
            {!result.data.public_after_delay && <p className="tiny tertiary" style={{ lineHeight: 1.6, marginTop: 12 }}>This snapshot is still inside the delay window. The hash is checkable on-chain now; the full JSON will be released later. Holder sessions can verify immediately after proving ownership.</p>}
          </> : result.data ? <EmptyState title="No matching commitment" body={result.data.error || 'Check the ID or hash and try again.'} /> : <EmptyState title="Enter a snapshot ID" body="The verifier reads the contract view and the released vault snapshot." />}
          {result.updatedAt && <p className="tiny tertiary" role="status">Lookup completed: {new Date(result.updatedAt).toLocaleTimeString()}</p>}
          <p className="tiny tertiary" style={{ marginTop: 14, marginBottom: 0 }}>This server result is for convenience only. Use the browser panel to recompute the hash yourself from the released JSON bytes.</p>
        </Card>
        <ProofPanel snapshotId={snapshotId} commitment={c ? { ...c, block_heights: heights } : undefined} />
        <Card className="col-12" title="Reproduce from the command line">
          <div className="bento" style={{ gap: 12 }}>
            <div className="col-6">
              <div className="card-surface terminal" style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
                <div style={{ color: 'var(--text-3)' }}># from the monorepo root</div>
                <div><span style={{ color: 'var(--green)' }}>$</span> corepack pnpm verify {snapshotId || '&lt;snapshot_id&gt;'} --recompute</div>
                <div style={{ color: 'var(--text-3)', marginTop: 8 }}># prints the canonical hash and the on-chain hash</div>
                <div><span style={{ color: 'var(--green)' }}>✓</span> MATCH — byte-for-byte identical</div>
              </div>
            </div>
            <div className="col-6">
              <p className="small muted" style={{ lineHeight: 1.7, marginTop: 0 }}>The CLI loads the local vault JSON, strips proof metadata, canonicalizes with JCS rules, computes SHA-256 and reads <span className="mono tiny">latest_snapshot</span> / <span className="mono tiny">snapshot_by_id</span> from <span className="mono tiny">sntl-02e90eacb8.testnet</span>. It never asks the gateway to decide whether the hash is valid.</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                <Link href="/proof" className="btn btn-ghost btn-sm">All commitments <ArrowRight size={13} /></Link>
                <a href="https://testnet.nearblocks.io/accounts/sntl-02e90eacb8.testnet" target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm"><ExternalLink size={13} /> Contract</a>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
