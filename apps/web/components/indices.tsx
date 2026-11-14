'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';
import { motion } from 'framer-motion';
import { Card, Badge, Chip, CountUp, fmt, usd } from './ui';
import { useJson } from '@/lib/api';

const ease = [0.22, 1, 0.36, 1] as const;

function IndexHeader({ n, title, sub, badges }: { n: string; title: string; sub: string; badges?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 18 }}>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <span className="mono tiny" style={{ color: 'var(--green)', border: '1px solid rgba(0,236,151,.25)', borderRadius: 7, padding: '4px 7px', marginTop: 2 }}>{n}</span>
        <div><h3 className="h3" style={{ marginBottom: 4 }}>{title}</h3><p className="small muted" style={{ maxWidth: 560, lineHeight: 1.55 }}>{sub}</p></div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{badges}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ Capital Flow */
export function CapitalFlow({ flow, blocks }: { flow: any; blocks?: Record<string, number> }) {
  const cohorts: any[] = flow?.cohorts || [];
  const graph = useMemo(() => {
    const active = cohorts.filter((c) => Math.abs(c.net_usd) > 0.005);
    if (!active.length) return null;
    const nodes = [
      { id: 'source', label: 'Observed balance change' },
      ...active.map((c) => ({ id: c.id, label: c.label })),
      { id: 'sink', label: 'Net, inferred flow' },
    ];
    const links = active.flatMap((c) => ([
      { source: 'source', target: c.id, value: Math.abs(c.net_usd), sign: Math.sign(c.net_usd) },
      { source: c.id, target: 'sink', value: Math.abs(c.net_usd), sign: Math.sign(c.net_usd) },
    ]));
    try {
      const g: any = sankey()
        .nodeId((d: any) => d.id)
        .nodeWidth(11).nodePadding(18)
        .extent([[8, 10], [660, 250]])({ nodes: nodes.map((d) => ({ ...d })), links: links.map((d) => ({ ...d })) });
      return g;
    } catch { return null; }
  }, [cohorts]);
  const path = sankeyLinkHorizontal();
  const maxAbs = Math.max(1, ...cohorts.map((c) => Math.abs(c.net_usd)));

  return (
    <Card className="col-12" style={{ padding: 26 }}>
      <IndexHeader n="01" title="Capital Flow Map" sub={`Net balance deltas across RPC-verified accounts. ${flow?.method || 'snapshot-diff'}; a diff is an inferred net flow, never a gross transfer.`} badges={<><Badge kind="fact">RPC-verified accounts</Badge><Badge kind="assumption">Net / inferred flow</Badge></>} />
      <div className="bento" style={{ gap: 14 }}>
        <div className="col-7" style={{ minWidth: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            {graph ? (
              <svg viewBox="0 0 680 270" role="img" aria-label="Sankey of net, inferred capital flows by cohort" style={{ width: '100%', minWidth: 440 }}>
                <defs>
                  <linearGradient id="pos" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#00EC97" stopOpacity=".55" /><stop offset="100%" stopColor="#4FD1FF" stopOpacity=".45" /></linearGradient>
                  <linearGradient id="neg" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#FF5C7A" stopOpacity=".5" /><stop offset="100%" stopColor="#FFB547" stopOpacity=".4" /></linearGradient>
                </defs>
                {graph.links.map((l: any, i: number) => (
                  <motion.path key={i} d={path(l)} fill="none" stroke={l.sign >= 0 ? 'url(#pos)' : 'url(#neg)'} strokeWidth={Math.max(1, l.width)}
                    initial={{ opacity: 0 }} whileInView={{ opacity: .72 }} viewport={{ once: true }} transition={{ duration: .8, delay: i * .05, ease }} />
                ))}
                {graph.nodes.map((n: any) => (
                  <g key={n.id}>
                    <rect x={n.x0} y={n.y0} width={n.x1 - n.x0} height={Math.max(2, n.y1 - n.y0)} rx={4} fill={n.id === 'sink' ? 'var(--violet)' : n.id === 'source' ? 'var(--green)' : 'rgba(255,255,255,.55)'} />
                    <text x={n.x0 < 340 ? n.x1 + 9 : n.x0 - 9} y={(n.y0 + n.y1) / 2 + 3} textAnchor={n.x0 < 340 ? 'start' : 'end'} fill="#9AA7B5" fontSize="9.5" fontFamily="ui-monospace,monospace">{n.label}</text>
                  </g>
                ))}
                <text x="8" y="264" fill="#6F7C8A" fontSize="9" fontFamily="ui-monospace,monospace">GREEN / CYAN = NET INFLOW · ROSE / AMBER = NET OUTFLOW · BAND WIDTH = |NET USD|</text>
              </svg>
            ) : <div className="small muted" style={{ padding: '60px 0', textAlign: 'center' }}>No non-zero balance deltas in this window. The agent will keep measuring.</div>}
          </div>
        </div>
        <div className="col-5" style={{ minWidth: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 12, marginBottom: 14 }}>
            <div className="card-surface" style={{ padding: 14, borderRadius: 12, border: '1px solid var(--border)' }}>
              <div className="card-title" style={{ marginBottom: 8 }}>Observed net change · NEAR</div>
              <div className="num" style={{ fontSize: 25, color: (flow?.total_net_near || 0) >= 0 ? 'var(--green)' : 'var(--rose)' }}>
                {(flow?.total_net_near || 0) >= 0 ? '+' : ''}<CountUp value={flow?.total_net_near || 0} digits={2} />
              </div>
            </div>
            <div className="card-surface" style={{ padding: 14, borderRadius: 12, border: '1px solid var(--border)' }}>
              <div className="card-title" style={{ marginBottom: 8 }}>Observed net change · USD</div>
              <div className="num" style={{ fontSize: 25, color: (flow?.total_net_usd || 0) >= 0 ? 'var(--green)' : 'var(--rose)' }}>
                {(flow?.total_net_usd || 0) >= 0 ? '+' : ''}$<CountUp value={flow?.total_net_usd || 0} digits={0} />
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {cohorts.map((c) => (
              <div key={c.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
                  <span className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
                  <span className="mono tiny" style={{ color: c.net_usd >= 0 ? 'var(--green)' : 'var(--rose)' }}>{c.net_usd >= 0 ? '+' : ''}{usd(c.net_usd)}</span>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 3, overflow: 'hidden' }}>
                  <motion.div initial={{ width: 0 }} whileInView={{ width: `${Math.max(3, Math.abs(c.net_usd) / maxAbs * 100)}%` }} viewport={{ once: true }} transition={{ duration: .8, ease }}
                    style={{ height: '100%', background: c.net_usd >= 0 ? 'var(--green)' : 'var(--rose)', marginLeft: c.net_usd >= 0 ? 0 : 'auto' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {blocks && Object.entries(blocks).map(([k, v]) => <Chip key={k}>{k}: {v.toLocaleString()}</Chip>)}
        {flow?.reference && <Chip>{flow.reference.startsWith('snapshot:') ? 'diff vs previous real snapshot' : flow.reference}</Chip>}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ Cost Model */
const SLIDERS = [
  { key: 'agents', label: 'Agents', min: 1, max: 500, step: 1, format: (v: number) => String(v) },
  { key: 'txPerAgentDay', label: 'Tx / agent / day', min: 1, max: 2000, step: 1, format: (v: number) => String(v) },
  { key: 'avgTgasPerTx', label: 'Avg Tgas / tx', min: 0.05, max: 5, step: 0.05, format: (v: number) => v.toFixed(2) },
  { key: 'persistentStorageMB', label: 'Persistent storage (MB)', min: 0, max: 50, step: 0.5, format: (v: number) => v.toFixed(1) },
  { key: 'inferenceTokensPerDay', label: 'Tokens / day', min: 0, max: 2_000_000, step: 10_000, format: (v: number) => fmt(v, 0) },
  { key: 'infraUsdPerMonth', label: 'Infra USD / month', min: 0, max: 500, step: 5, format: (v: number) => `$${v}` },
];
const MODELS = ['Qwen/Qwen3.8-27B', 'z-ai/glm-5.3-flash', 'deepseek-ai/DeepSeek-V4.1-Flash-1017', 'openai/gpt-5-nano', 'Qwen/Qwen3.6-35B-A3B-FP8'];

export function CostOfLiving({ initial }: { initial: any }) {
  const [scenario, setScenario] = useState<any>({ agents: 10, txPerAgentDay: 100, avgTgasPerTx: 0.3, persistentStorageMB: 1, inferenceTokensPerDay: 200000, model: MODELS[0], infraUsdPerMonth: 0 });
  const [quote, setQuote] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await fetch('/api/cost/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(scenario) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'quote failed');
        if (!cancelled) { setQuote(j); setError(''); }
      } catch (e) { if (!cancelled) setError((e as Error).message); }
      finally { if (!cancelled) setBusy(false); }
    }, 220);
    return () => { cancelled = true; clearTimeout(t); };
  }, [scenario]);

  const result = quote?.result || initial;
  const comparison = result?.comparison || [];
  const maxCost = Math.max(1, ...comparison.map((c: any) => c.monthly_usd));

  return (
    <Card className="col-7" style={{ padding: 26 }}>
      <IndexHeader n="02" title="Builder Cost-of-Living Calculator" sub="A pure function over live gas, storage, price and published model rates. Move a slider; every number is recomputed from the same real snapshot." badges={<><Badge kind="fact">Live params</Badge><Badge kind="measured">Published model catalog</Badge><Badge kind="assumption">Editable scenario</Badge></>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px 22px', marginBottom: 22 }}>
        {SLIDERS.map((s) => (
          <label key={s.key} style={{ display: 'block' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 7 }}><span className="small muted">{s.label}</span><span className="mono tiny" style={{ color: 'var(--green)' }}>{s.format(scenario[s.key])}</span></div>
            <input className="range" type="range" min={s.min} max={s.max} step={s.step} value={scenario[s.key]} aria-label={s.label}
              onChange={(e) => setScenario((p: any) => ({ ...p, [s.key]: Number(e.target.value) }))} />
          </label>
        ))}
        <label style={{ display: 'block' }}>
          <div className="small muted" style={{ marginBottom: 7 }}>Inference model <span className="chip chip-green" style={{ height: 20, marginLeft: 4 }}>published</span></div>
          <select className="input" value={scenario.model} onChange={(e) => setScenario((p: any) => ({ ...p, model: e.target.value }))} aria-label="Inference model">
            {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
      </div>
      <div className="hairline" style={{ margin: '4px 0 20px' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 18 }}>
        <div className="card-surface" style={{ padding: 14, borderRadius: 12, border: '1px solid var(--border)' }}>
          <div className="card-title">Spent / month</div>
          <div className="num" style={{ fontSize: 26, color: 'var(--green)', marginTop: 6 }}>${result?.monthly?.total_usd?.toFixed(2) ?? '—'}</div>
          <div className="tiny tertiary" style={{ marginTop: 4 }}>gas + inference + infra</div>
        </div>
        <div className="card-surface" style={{ padding: 14, borderRadius: 12, border: '1px solid var(--border)' }}>
          <div className="card-title">Cost / 1k actions</div>
          <div className="num" style={{ fontSize: 26, marginTop: 6 }}>${result?.cost_per_1000_actions_usd?.toFixed(4) ?? '—'}</div>
          <div className="tiny tertiary" style={{ marginTop: 4 }}>{fmt(result?.actionsPerMonth, 0)} actions/mo</div>
        </div>
        <div className="card-surface" style={{ padding: 14, borderRadius: 12, border: '1px solid var(--border)' }}>
          <div className="card-title">Storage locked (not spent)</div>
          <div className="num" style={{ fontSize: 26, color: 'var(--violet)', marginTop: 6 }}>{fmt(result?.monthly?.storage_locked_near, 1)} <span className="tiny tertiary">NEAR</span></div>
          <div className="tiny tertiary" style={{ marginTop: 4 }}>≈ {usd(result?.monthly?.storage_locked_usd)} refundable</div>
        </div>
      </div>
      <div className="card-title" style={{ marginBottom: 10 }}>Monthly cost by chain · same workload</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {comparison.map((c: any) => (
          <div key={c.chain}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
              <span className="small muted">{c.chain} {c.assumptions?.some((a: string) => a.includes('ASSUMPTION')) && <span className="chip chip-amber" style={{ height: 18, marginLeft: 6 }}>partly assumed</span>}</span>
              <span className="mono tiny">${c.monthly_usd.toFixed(2)}</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,.06)', borderRadius: 4 }}>
              <motion.div initial={{ width: 0 }} whileInView={{ width: `${c.monthly_usd / maxCost * 100}%` }} viewport={{ once: true }} transition={{ duration: .7, ease }}
                style={{ height: '100%', borderRadius: 4, background: c.chain === 'NEAR' ? 'linear-gradient(90deg,#00EC97,#4FD1FF)' : 'rgba(255,255,255,.28)' }} />
            </div>
          </div>
        ))}
      </div>
      <details style={{ marginTop: 18 }}><summary className="small muted" style={{ cursor: 'pointer' }}>Formulas, live values & assumptions ({busy ? 'recomputing…' : 'current'})</summary>
        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
          {(result?.assumptions_used || []).map((a: string) => <div key={a} className="tiny tertiary mono">· {a}</div>)}
          {(result?.formulas || []).map((f: string) => <div key={f} className="tiny tertiary mono">= {f}</div>)}
          {quote?.provenance && <div className="tiny tertiary mono">snapshot {quote.provenance.snapshot_id} · {quote.provenance.mode}{quote.provenance.stale ? ' · STALE' : ''}</div>}
        </div>
      </details>
      {error && <p className="small" style={{ color: 'var(--rose)', marginTop: 10 }} role="alert">{error}</p>}
    </Card>
  );
}

/* ------------------------------------------------------------------ Health Index */
export function HealthIndex({ health }: { health: any }) {
  const score = Math.max(0, Math.min(100, health?.score ?? 0));
  const R = 82; const circ = Math.PI * R;
  return (
    <Card className="col-5" style={{ padding: 26 }}>
      <IndexHeader n="03" title="Agent Economy Health Index" sub="Fixed bounds and fixed weights, published in methodology v1. Measures our own fleet plus RPC-verified cohorts — not a price signal." badges={<><Badge kind="fact">Fixed weights</Badge><Badge kind="assumption">Coverage {Math.round((health?.coverage ?? 0) * 100)}%</Badge></>} />
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', margin: '4px 0 18px' }}>
        <svg viewBox="0 0 210 122" width="210" height="122" role="img" aria-label={`Health index score ${score.toFixed(1)} out of 100`}>
          <path d="M 23 105 A 82 82 0 0 1 187 105" className="gauge-track" fill="none" strokeWidth="13" strokeLinecap="round" />
          <motion.path d="M 23 105 A 82 82 0 0 1 187 105" fill="none" stroke="url(#hg)" strokeWidth="13" strokeLinecap="round"
            strokeDasharray={circ} initial={{ strokeDashoffset: circ }} whileInView={{ strokeDashoffset: circ * (1 - score / 100) }} viewport={{ once: true }} transition={{ duration: 1.1, ease }} />
          <defs><linearGradient id="hg" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#FF5C7A" /><stop offset="50%" stopColor="#FFB547" /><stop offset="100%" stopColor="#00EC97" /></linearGradient></defs>
        </svg>
        <div style={{ position: 'absolute', bottom: 4, textAlign: 'center' }}>
          <div className="num" style={{ fontSize: 42, lineHeight: 1 }}><CountUp value={score} digits={1} /></div>
          <div className="tiny tertiary" style={{ letterSpacing: '.1em', textTransform: 'uppercase' }}>health / 100</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div className="card-surface" style={{ padding: 12, borderRadius: 11, border: '1px solid var(--border)' }}><div className="card-title">Confidence</div><div className="num" style={{ fontSize: 20, marginTop: 4 }}>{Math.round((health?.confidence ?? 0) * 100)}%</div></div>
        <div className="card-surface" style={{ padding: 12, borderRadius: 11, border: '1px solid var(--border)' }}><div className="card-title">Fleet agents</div><div className="num" style={{ fontSize: 20, marginTop: 4 }}>{health?.fleet?.agents ?? '—'} <span className="tiny" style={{ color: 'var(--green)' }}>{health?.fleet?.active ?? 0} active</span></div></div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {(health?.components || []).map((c: any) => (
          <div key={c.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
              <span className="small muted" style={{ textTransform: 'capitalize' }}>{c.id.replace('_', ' ')} <span className="tiny tertiary">· w {c.weight}</span></span>
              <span className="mono tiny">{c.normalized.toFixed(1)} / 100</span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 3 }}><div style={{ width: `${c.normalized}%`, height: '100%', background: c.normalized > 66 ? 'var(--green)' : c.normalized > 33 ? 'var(--amber)' : 'var(--rose)', borderRadius: 3 }} /></div>
          </div>
        ))}
      </div>
      <p className="tiny tertiary" style={{ marginTop: 16, lineHeight: 1.6, marginBottom: 0 }}>{health?.what_this_is_not}</p>
      {(health?.cohorts || []).map((c: any) => <div key={c.id} className="tiny tertiary mono" style={{ marginTop: 6 }}>· {c.id}: {c.accounts} accounts — {c.status}</div>)}
    </Card>
  );
}
