'use client';
import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Activity, Clock3, Database, ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react';
import { CapitalFlow, CostOfLiving, HealthIndex } from './indices';
import { EcosystemPulse } from './ecosystem-pulse';
import { EvidenceGuide, LiveFleetEvidence } from './evidence-panel';
import { AgentEconomySummary } from './agent-economy-summary';
import { ProofPanel, CommitmentStrip } from './proof-panel';
import { Card, Chip, Badge, TimeAgo, absoluteTime, shortHash, HashRow, Skeleton, EmptyState } from './ui';
import { useJson, explorerTx } from '@/lib/api';

const ease = [0.22, 1, 0.36, 1] as const;

export function FreshnessBar({ delivery, snapshot, commitment }: { delivery: any; snapshot: any; commitment: any }) {
  return (
    <div className="card" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', padding: '15px 20px', marginBottom: 18 }}>
      <span className="chip chip-green"><span className="dot dot-live" />SAVED NETWORK REPORT</span>
      <Chip><Clock3 size={11} /> age <TimeAgo iso={snapshot?.epoch_ts} /></Chip>
      <Chip><Database size={11} /> {delivery?.observed_network} observe → {delivery?.settled_network} settle</Chip>
      <Chip>{snapshot?.inputs?.queries?.length || 0} recorded query entries</Chip>
      {delivery?.stale && <Badge kind="stale">OLDER SAVED REPORT</Badge>}
      {delivery?.replay && <Badge kind="replay">SAVED VIEW · NOT A LIVE FEED</Badge>}
      <Chip>{snapshot?.methodology_version || 'v1'}</Chip>
      <span className="tiny tertiary mono" style={{ marginLeft: 'auto' }} title={absoluteTime(snapshot?.epoch_ts)}>{snapshot?.epoch_ts}</span>
      <Link href="/proof" className="btn btn-ghost btn-sm"><ShieldCheck size={13} /> Proof</Link>
    </div>
  );
}

export function HistoryTable() {
  const h = useJson<any>('/api/vault/history', { intervalMs: 60000 });
  return (
    <Card className="col-12" title="Saved reports you can check" right={<div style={{ display: 'flex', gap: 6 }}><Chip>{h.data?.items?.length || 0} snapshots</Chip><button className="btn btn-ghost btn-sm" onClick={h.refresh} aria-label="Refresh history"><RefreshCw size={13} /></button></div>}>
      {h.loading && !h.data ? <div style={{ display: 'grid', gap: 10 }}><Skeleton h={30} /><Skeleton h={30} /><Skeleton h={30} /></div> : h.error ? <EmptyState title="History unavailable" body={h.error} /> : (h.data?.items?.length ? (
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th>Snapshot</th><th>Observed</th><th>Content hash</th><th>Commitment tx</th><th>Mode</th><th>Verify</th></tr></thead>
            <tbody>{h.data.items.map((x: any) => <tr key={x.id}>
              <td style={{ color: 'var(--cyan)' }}>{shortHash(x.id, 18)}</td>
              <td><TimeAgo iso={x.epoch_ts} /></td>
              <td style={{ color: 'var(--cyan)' }}>{shortHash(x.content_hash, 12)}</td>
              <td>{x.tx ? <a href={explorerTx(x.tx)} target="_blank" rel="noreferrer" style={{ color: 'var(--green)' }}>{shortHash(x.tx, 10)} <ExternalLink size={10} style={{ verticalAlign: -1 }} /></a> : '—'}</td>
              <td><span className={`chip ${x.mode === 'live' ? 'chip-green' : 'chip-violet'}`}>{x.mode}{x.stale ? ' · stale' : ''}</span></td>
              <td><Link href={`/verify?q=${encodeURIComponent(x.id)}`} className="btn btn-ghost btn-sm">Verify</Link></td>
            </tr>)}</tbody>
          </table>
        </div>) : <EmptyState title="No history yet" body="The first agent round will appear here after its snapshot is committed on-chain." />)}
    </Card>
  );
}

export function VaultDashboard({ vault }: { vault: any }) {
  const evidence = useJson<any>('/chain-evidence',{auth:false});
  const l=evidence.data?.evidence?.liquidity; const paired=l?.flow?l:null;
  const s = vault?.snapshot; const d = vault?.delivery; const c = vault?.commitment;
  if (!s) return <div className="wrap section"><Card><EmptyState title="Vault is empty" body="No saved report is available right now. Your investigation and watchlist tools are separate." /></Card></div>;
  return (
    <div className="wrap" style={{ paddingTop: 42, paddingBottom: 40 }}>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5, ease }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 24 }}>
          <div>
            <span className="eyebrow">NEAR MAINNET / LIQUIDITY, TRADING & REVENUE</span>
            <h1 className="h2" style={{ marginTop: 10 }}>NEAR Ecosystem<br/><span className="serif" style={{ color: 'var(--green)' }}>Liquidity Intelligence.</span></h1>
            <p className="small muted" style={{ marginTop: 10, maxWidth: 610, lineHeight: 1.6 }}>{s.snapshot_id} · {s.inputs?.queries?.length || 0} recorded source queries (not all block-pinned) · recorded publisher {c?.publisher_account || s.meta?.agent_account}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Link href="/agent/0" className="btn btn-ghost btn-sm"><Activity size={13} /> Meet the agent</Link><Link href="/proof" className="btn btn-primary btn-sm"><ShieldCheck size={13} /> Check this report</Link></div>
        </div>
        <FreshnessBar delivery={d} snapshot={s} commitment={c} />
      </motion.div>

      <div className="bento" style={{ rowGap: 16 }}>
        <EvidenceGuide/>
        <CapitalFlow flow={paired?.flow||s.capital_flow} blocks={paired?{'mainnet.pinned_resolved':paired.earlier.height,'mainnet.latest':paired.later.height}:s.inputs?.blocks} prices={paired?{near_usd:paired.price?.near_usd,price_observed_at:paired.price?.observed_at}:s.inputs?.prices} observedAt={s.epoch_ts} reading={paired}/>
        <EcosystemPulse/>
        <section id="agentic-economy" className="card col-12" style={{padding:26,marginTop:20,scrollMarginTop:90}} aria-labelledby="agentic-title">
          <span className="eyebrow">A DIFFERENT LENS / AGENT ACTIVITY & ECONOMICS</span>
          <h2 id="agentic-title" className="h2" style={{marginTop:12}}>Agentic Economy Intel</h2>
          <p className="lead" style={{maxWidth:850}}>Are the sampled agents doing work, and what would your own setup cost? Explore activity first, then build a running budget. These figures are separate from ecosystem TVL and trading volume.</p>
          <p className="small muted">Activity uses the saved Sentinel fleet sample—not a census of all AI agents on NEAR. The budget uses saved rates and your chosen workload.</p>
          <LiveFleetEvidence packet={evidence.data} loading={evidence.loading} error={evidence.error} refresh={evidence.refresh}/>
          <AgentEconomySummary health={s.agent_health} cost={s.cost_of_living}/>
          <h3 className="h3" style={{marginTop:28}}>Full agent health & running-cost intelligence</h3>
          <div className="bento" style={{gap:16,marginTop:24}}><HealthIndex health={s.agent_health}/><CostOfLiving initial={s.cost_of_living}/></div>
        </section>
        <ProofPanel snapshotId={s.snapshot_id} fullSnapshot={s} commitment={c} />
        <HistoryTable />
        <Card className="col-6" title="Where these numbers came from">
          {Object.entries(s.inputs?.blocks || {}).map(([k, v]: any) => <div className="kv" key={k}><span className="kv-k">{k}</span><span className="kv-v">{Number(v).toLocaleString()}</span></div>)}
          <div className="kv"><span className="kv-k">Price source</span><span className="kv-v" style={{ maxWidth: 260, wordBreak: 'break-all' }}>{s.inputs?.prices?.price_source}</span></div>
          <div className="kv"><span className="kv-k">Price observed</span><span className="kv-v">{new Date((s.inputs?.prices?.price_observed_at || 0) * 1000).toUTCString()}</span></div>
          <div className="kv"><span className="kv-k">Queries</span><span className="kv-v">{s.inputs?.queries?.length} · {s.inputs?.queries?.filter((q: any) => q.status === 'ok').length} ok</span></div>
          <details style={{ marginTop: 14 }}><summary className="small muted" style={{ cursor: 'pointer' }}>Show every query ({s.inputs?.queries?.length})</summary>
            <div style={{ marginTop: 12, maxHeight: 230, overflow: 'auto' }}>
              {s.inputs?.queries?.map((q: any, i: number) => <div key={i} className="tiny tertiary mono" style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }}>{q.status === 'ok' ? '✓' : q.status} {q.id} · {q.url} · digest {q.response_digest}{q.block_height ? ` · block ${q.block_height}` : ''}</div>)}
            </div>
          </details>
        </Card>
        <Card className="col-6" title="How to read this report">
          <p className="small muted">Account balances are recorded chain readings. The cost tool is a budget calculator. Agent activity describes the sample captured at the report time. Open the details when you want the inputs behind a number.</p>
          <details><summary>Source notes & calculation inputs</summary>
          {(s.meta?.notes || []).map((n: string, i: number) => <div key={i} className="small muted" style={{ lineHeight: 1.6, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>· {n}</div>)}
          {(s.cost_of_living?.assumptions_used || []).map((a: string, i: number) => <div key={i} className="tiny tertiary mono" style={{ padding: '5px 0' }}>· {a}</div>)}
          </details>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}><Badge kind="fact">Recorded chain data</Badge><Badge kind="measured">Checked against the chain</Badge><Badge kind="assumption">Budget estimates</Badge></div>
          <p className="tiny tertiary" style={{ lineHeight: 1.6, marginTop: 14 }}>If a free source fails, the runtime serves the last real snapshot with a visible STALE badge. It never fabricates or silently synthesizes a number.</p>
          <div style={{ marginTop: 14 }}><HashRow label="Snapshot hash" value={c?.content_hash} /><HashRow label="Commitment tx" value={c?.commitment_tx} href={c?.explorer_url} /></div>
        </Card>
      </div>
    </div>
  );
}
