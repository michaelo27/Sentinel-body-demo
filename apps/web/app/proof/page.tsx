'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, ExternalLink, Terminal, RefreshCw, ChevronRight } from 'lucide-react';
import { ProofPanel, CommitmentStrip } from '@/components/proof-panel';
import { Card, Chip, HashRow, shortHash, Badge, Skeleton, EmptyState } from '@/components/ui';
import { useJson, explorerTx } from '@/lib/api';

export default function ProofPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const list = useJson<any>('/api/public/commitments', { auth: false, intervalMs: 60000 });
  const pub = useJson<any>('/api/public/commitment', { auth: false, intervalMs: 30000 });

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('q');
    if (p) { setQ(p); setSelected(p); }
  }, []);
  useEffect(() => {
    if (!selected && list.data?.items?.length) {
      const firstPublic = list.data.items.find((x: any) => x.public_after_delay) || list.data.items[0];
      setSelected(firstPublic.id);
    }
  }, [list.data, selected]);

  const item = list.data?.items?.find((x: any) => x.id === selected || x.content_hash === selected) || null;
  const heights = typeof item?.observed_block_heights === 'string' ? (() => { try { return JSON.parse(item.observed_block_heights); } catch { return {}; } })() : (item?.observed_block_heights || {});

  return (
    <div className="wrap" style={{ paddingTop: 48, paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div><span className="eyebrow">REPORTS YOUR AGENTS PUBLISHED</span><h1 className="h2" style={{ marginTop: 10 }}>See the record. Check the report.</h1><p className="lead" style={{ maxWidth: 660, marginTop: 12 }}>Each published report has a digital fingerprint stored on NEAR. Pick a record to see who published it. When the full report is available, your browser can check whether its contents match.</p></div>
        <Link href="/verify" className="btn btn-ghost"><Terminal size={15} /> Find a report by ID or fingerprint</Link>
      </div>

      <div style={{ margin: '26px 0 18px' }}><CommitmentStrip commitment={pub.data?.commitment} /></div>

      <div className="bento" style={{ rowGap: 16 }}>
        <Card className="col-5" title="On-chain commitments · direct view call" right={<Chip>{list.data?.items?.length || 0} records</Chip>}>
          {list.loading && !list.data ? <div style={{ display: 'grid', gap: 10 }}><Skeleton h={60} /><Skeleton h={60} /><Skeleton h={60} /></div> : list.error ? <EmptyState title="Contract view failed" body={list.error} /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 480, overflow: 'auto' }}>
              {(list.data?.items || []).map((x: any) => (
                <button key={x.id} onClick={() => { setSelected(x.id); setQ(x.id); }} className="btn btn-ghost" style={{
                  justifyContent: 'space-between', alignItems: 'flex-start', textAlign: 'left', padding: '12px 14px', height: 'auto', minHeight: 70,
                  borderColor: selected === x.id ? 'rgba(0,236,151,.45)' : 'var(--border)', background: selected === x.id ? 'rgba(0,236,151,.06)' : 'var(--surface)',
                }}>
                  <span style={{ minWidth: 0 }}>
                    <span className="mono tiny" style={{ color: 'var(--cyan)', display: 'block' }}>{shortHash(x.id, 20)}</span>
                    <span className="tiny tertiary mono" style={{ display: 'block', marginTop: 5 }}>{shortHash(x.content_hash, 14)} · #{x.token_id}</span>
                    <span style={{ marginTop: 7, display: 'flex', gap: 5, flexWrap: 'wrap' }}><span className="chip chip-green" style={{ height: 20 }}>block {x.block_height?.toLocaleString()}</span>{x.public_after_delay ? <span className="chip" style={{ height: 20 }}>PUBLIC FULL DATA</span> : <span className="chip chip-amber" style={{ height: 20 }}>DELAY WINDOW</span>}</span>
                  </span>
                  <ChevronRight size={14} color="var(--text-3)" />
                </button>
              ))}
            </div>
          )}
          <p className="tiny tertiary" style={{ marginTop: 12, marginBottom: 0, lineHeight: 1.6 }}>Source: <span className="mono">view_function sntl-02e90eacb8.testnet.snapshots</span> via ordered free RPC fallbacks. No indexer required.</p>
        </Card>

        <Card className="col-7" title="Selected commitment">
          {item ? <>
            <HashRow label="Snapshot ID" value={item.id} />
            <HashRow label="Content hash" value={item.content_hash} />
            <HashRow label="Publisher agent" value={item.agent_account} href={`https://testnet.nearblocks.io/accounts/${item.agent_account}`} />
            <HashRow label="Commitment tx" value={item.commitment_tx} href={item.explorer_url || (item.commitment_tx ? explorerTx(item.commitment_tx) : undefined)} />
            <div className="kv"><span className="kv-k">Testnet block</span><span className="kv-v">{item.block_height?.toLocaleString()}</span></div>
            <div className="kv"><span className="kv-k">Timestamp</span><span className="kv-v">{new Date(Number(item.block_timestamp) / 1e6).toUTCString()}</span></div>
            <div className="kv"><span className="kv-k">Methodology</span><span className="kv-v">{item.methodology_version}</span></div>
            {Object.entries(heights).map(([k, v]: any) => <div className="kv" key={k}><span className="kv-k">Pinned {k}</span><span className="kv-v">{Number(v).toLocaleString()}</span></div>)}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
              <Badge kind="fact">On-chain view</Badge>
              {item.public_after_delay ? <Badge kind="fact">Full data released</Badge> : <Badge kind="assumption">Full data after delay</Badge>}
              <Link href={`/verify?q=${encodeURIComponent(item.id)}`} className="btn btn-ghost btn-sm">Open verifier <ChevronRight size={13} /></Link>
            </div>
          </> : <EmptyState title="Select a commitment" body="Pick a record to inspect its hash, publisher and pinned heights." />}
        </Card>

        <ProofPanel snapshotId={item?.id || selected || q || null} commitment={item ? { ...item, block_heights: heights, commitment_tx: item.commitment_tx } : pub.data?.commitment} />

        <Card className="col-12" title="The verification contract">
          <div className="bento" style={{ gap: 12 }}>
            {[
              { t: '1. Deterministic document', d: 'The snapshot is canonicalized with JCS rules: sorted keys, no whitespace, ECMAScript number serialization. Proof metadata is excluded before hashing.' },
              { t: '2. One hash, three places', d: 'The agent computes SHA-256, the contract stores it in publish_snapshot, and the vault stores the full JSON. The CLI, gateway and browser use the same canonical function.' },
              { t: '3. Restricted signer', d: 'The commitment is signed by agent-<id>.sntl-02e90eacb8.testnet with a function-call key limited to publish_snapshot, with a gas allowance and no FullAccess key.' },
              { t: '4. Public audit', d: 'After the public delay the complete snapshot is released. Non-holders can recompute the hash with WebCrypto and compare it against the contract view call. No server trust.' },
            ].map((x, i) => <div key={x.t} className="col-3"><div className="card-surface" style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 12, height: '100%' }}><span className="mono tiny" style={{ color: 'var(--green)' }}>0{i + 1}</span><h3 className="h3" style={{ fontSize: 15, marginTop: 10 }}>{x.t}</h3><p className="tiny tertiary" style={{ lineHeight: 1.6, marginBottom: 0 }}>{x.d}</p></div></div>)}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}>
            <Chip>CLI: pnpm verify {item?.id || '<snapshot_id>'} --recompute</Chip>
            <Chip>docs/METHODOLOGY.md</Chip>
            <Chip>docs/SOURCES.md</Chip>
            <a href="https://testnet.nearblocks.io/accounts/sntl-02e90eacb8.testnet" target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm"><ExternalLink size={13} /> Contract explorer</a>
          </div>
        </Card>
      </div>
    </div>
  );
}
