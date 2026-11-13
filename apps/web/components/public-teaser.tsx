'use client';
import React from 'react';
import Link from 'next/link';
import { ArrowRight, Clock3, Lock, ShieldCheck } from 'lucide-react';
import { Card, Chip, Badge, fmt, usd, TimeAgo, shortHash } from './ui';
import { CoarseChart } from './coarse-chart';
import { useJson } from '@/lib/api';

export function PublicTeaser({ compact = false }: { compact?: boolean }) {
  const pub = useJson<any>('/api/public/latest', { auth: false, intervalMs: 30000 });
  const s = pub.data?.snapshot; const d = pub.data?.delivery; const c = pub.data?.live_commitment;
  return (
    <div className="bento">
      <Card className="col-7" style={{ padding: 26 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          <div><span className="eyebrow">Public tier · delayed {d?.delay_minutes ?? 15} minutes</span><h2 className="h3" style={{ marginTop: 8 }}>Real data, deliberately dimmed.</h2></div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{d?.stale && <Badge kind="stale">STALE</Badge>}{d?.replay && <Badge kind="replay">REPLAY</Badge>}<Chip><Clock3 size={11} /> <TimeAgo iso={s?.epoch_ts} /></Chip></div>
        </div>
        {pub.loading && !s ? <div style={{ display: 'grid', gap: 12 }}><div className="skeleton" style={{ height: 70 }} /><div className="skeleton" style={{ height: 90 }} /></div> : s ? <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 18 }}>
            {[
              { k: 'Net flow · NEAR', v: fmt(s.headline?.capital_flow_net_near, 1), c: 'var(--green)' },
              { k: 'Cost / month', v: usd(s.headline?.cost_index_usd_per_month), c: 'var(--cyan)' },
              { k: 'Agent health', v: `${fmt(s.headline?.agent_health, 1)}/100`, c: 'var(--violet)' },
            ].map((x) => <div key={x.k} className="card-surface" style={{ padding: 13, border: '1px solid var(--border)', borderRadius: 12 }}><div className="card-title">{x.k}</div><div className="num" style={{ fontSize: 21, color: x.c, marginTop: 7 }}>{x.v}</div></div>)}
          </div>
          <CoarseChart points={s.coarse_chart || []} />
          <p className="tiny tertiary" style={{ marginTop: 16, lineHeight: 1.6, marginBottom: 0 }}>Five coarse buckets, no account-level detail, no per-query data, released only after the public delay. {s.provenance?.note || ''}</p>
        </> : <p className="small muted">The first delayed snapshot has not been released yet. The on-chain commitment is already public.</p>}
      </Card>
      <Card className="col-5 locked" style={{ padding: 26, minHeight: 300 }}>
        <div className="locked-blur" style={{ display: 'grid', gap: 14 }}><div className="card-title">FULL RESOLUTION</div><div className="num" style={{ fontSize: 34 }}>+444,331.42</div>{[88, 70, 92, 60, 80].map((w, i) => <div key={i} className="skeleton" style={{ height: i === 4 ? 60 : 16, width: `${w}%` }} />)}</div>
        <div className="locked-overlay"><Lock size={22} color="var(--green)" /><h3 className="h3">Live tier is locked</h3><p className="small muted" style={{ maxWidth: 250, textAlign: 'center', lineHeight: 1.6, margin: 0 }}>Hold a Sentinel Body, prove ownership, unlock every query and pinned block.</p><Link href="/mint" className="btn btn-primary btn-sm">Unlock <ArrowRight size={13} /></Link></div>
      </Card>
      {c?.content_hash && <Card className="col-12" style={{ padding: '16px 20px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <ShieldCheck size={17} color="var(--green)" /><span className="small muted">The live hash is public immediately, even while the data is gated:</span>
        <span className="hash">{c.content_hash}</span>
        <Link href={`/verify?q=${encodeURIComponent(c.snapshot_id || c.content_hash)}`} className="btn btn-ghost btn-sm">Verify <ArrowRight size={13} /></Link>
      </Card>}
    </div>
  );
}
