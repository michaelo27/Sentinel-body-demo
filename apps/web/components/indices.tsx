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

/* Liquidity gets a dedicated full-width view; agent budgets remain separate. */
export { LiquidityMap as CapitalFlow } from './liquidity-map';

/* ------------------------------------------------------------------ Cost Model */
const SLIDERS = [
  { key: 'agents', label: 'Agents', min: 1, max: 500, step: 1, format: (v: number) => String(v) },
  { key: 'txPerAgentDay', label: 'Actions per agent each day', min: 1, max: 2000, step: 1, format: (v: number) => String(v) },
  { key: 'avgTgasPerTx', label: 'Gas per action (Tgas)', min: 0.05, max: 5, step: 0.05, format: (v: number) => v.toFixed(2) },
  { key: 'persistentStorageMB', label: 'Data stored on-chain (MB)', min: 0, max: 50, step: 0.5, format: (v: number) => v.toFixed(1) },
  { key: 'inferenceTokensPerDay', label: 'AI text tokens each day', min: 0, max: 2_000_000, step: 10_000, format: (v: number) => fmt(v, 0) },
  { key: 'infraUsdPerMonth', label: 'Hosting budget per month', min: 0, max: 500, step: 5, format: (v: number) => `$${v}` },
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
      <IndexHeader n="02" title="What would my agents cost to run?" sub="Build a monthly budget. Choose how many agents you want, how often they act and how much AI they use. These are estimates from saved rates, not charges to your wallet." badges={<><Badge kind="fact">Saved network rates</Badge><Badge kind="measured">Saved AI prices</Badge><Badge kind="assumption">Your usage plan</Badge></>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '14px 22px', marginBottom: 22 }}>
        {SLIDERS.map((s) => (
          <label key={s.key} style={{ display: 'block' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 7 }}><span className="small muted">{s.label}</span><span className="mono tiny" style={{ color: 'var(--green)' }}>{s.format(scenario[s.key])}</span></div>
            <input className="range" type="range" min={s.min} max={s.max} step={s.step} value={scenario[s.key]} aria-label={s.label}
              onChange={(e) => setScenario((p: any) => ({ ...p, [s.key]: Number(e.target.value) }))} />
          </label>
        ))}
        <label style={{ display: 'block' }}>
          <div className="small muted" style={{ marginBottom: 7 }}>AI model <span className="chip chip-green" style={{ height: 20, marginLeft: 4 }}>published</span></div>
          <select className="input" value={scenario.model} onChange={(e) => setScenario((p: any) => ({ ...p, model: e.target.value }))} aria-label="AI model">
            {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
      </div>
      <div className="card-surface" style={{padding:18,borderRadius:12,marginBottom:18}}><strong>Your budget, in plain English</strong><p className="small muted">At the settings shown, the monthly plan includes {usd(result?.monthly?.gas_usd)} in network fees, {usd(result?.monthly?.inference_usd)} for AI and {usd(result?.monthly?.infra_usd)} for hosting. Reduce daily actions or AI usage to see which choice lowers the estimate.</p><p className="small muted">Storage is different: NEAR is reserved while data occupies space. It is not a monthly subscription charge. These saved-rate estimates do not create a bill or move funds.</p></div>
      <div className="hairline" style={{ margin: '4px 0 20px' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 18 }}>
        <div className="card-surface" style={{ padding: 14, borderRadius: 12, border: '1px solid var(--border)' }}>
          <div className="card-title">Estimated monthly bill</div>
          <div className="num" style={{ fontSize: 26, color: 'var(--green)', marginTop: 6 }}>${result?.monthly?.total_usd?.toFixed(2) ?? '—'}</div>
          <div className="tiny tertiary" style={{ marginTop: 4 }}>network fees + AI + hosting</div>
        </div>
        <div className="card-surface" style={{ padding: 14, borderRadius: 12, border: '1px solid var(--border)' }}>
          <div className="card-title">Budget per 1,000 actions</div>
          <div className="num" style={{ fontSize: 26, marginTop: 6 }}>${result?.cost_per_1000_actions_usd?.toFixed(4) ?? '—'}</div>
          <div className="tiny tertiary" style={{ marginTop: 4 }}>{fmt(result?.actionsPerMonth, 0)} actions/mo</div>
        </div>
        <div className="card-surface" style={{ padding: 14, borderRadius: 12, border: '1px solid var(--border)' }}>
          <div className="card-title">NEAR reserved for storage</div>
          <div className="num" style={{ fontSize: 26, color: 'var(--violet)', marginTop: 6 }}>{fmt(result?.monthly?.storage_locked_near, 1)} <span className="tiny tertiary">NEAR</span></div>
          <div className="tiny tertiary" style={{ marginTop: 4 }}>≈ {usd(result?.monthly?.storage_locked_usd)} refundable</div>
        </div>
      </div>
      <div className="card-title" style={{ marginBottom: 10 }}>Compare monthly budgets · same usage</div>
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
      <details style={{ marginTop: 18 }}><summary className="small muted" style={{ cursor: 'pointer' }}>How this budget is calculated ({busy ? 'recomputing…' : 'current'})</summary>
        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
          {(result?.assumptions_used || []).map((a: string) => <div key={a} className="tiny tertiary mono">· {a.replace(/\s*\(ASSUMPTION\)/g, ' — budget input').replace(/\s*\(USER INPUT\)/g, ' — your setting').replace(/\s*\(PUBLISHED\)/g, ' — published rate')}</div>)}
          {(result?.formulas || []).map((f: string) => <div key={f} className="tiny tertiary mono">= {f.replace(/\(assumption\)/gi, '(budget input)')}</div>)}
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
  if (!health || !Number.isFinite(health.score)) return <Card className="col-5" title="Agent activity"><p>No activity reading is available in this report.</p></Card>;
  return (
    <Card className="col-5" style={{ padding: 26 }}>
      <IndexHeader n="03" title="How active is the sampled agent fleet?" sub="A summary score for the agents and accounts in this saved report. Higher means stronger activity on the measured signals—not a rating for the whole NEAR ecosystem." badges={<><Badge kind="fact">Activity score</Badge><Badge kind="assumption">Coverage {Math.round((health?.coverage ?? 0) * 100)}%</Badge></>} />
      <div className="card-surface" style={{padding:16,borderRadius:12,marginBottom:18}}><strong>{health?.fleet?.active ?? '—'} of {health?.fleet?.agents ?? '—'} sampled agents were active</strong><p className="small muted">This is the activity captured in the saved report—not a live uptime check. Use the breakdown to see which signals contributed to the score. For a specific buddy, open its agent page and inspect recent report publications.</p></div>
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', margin: '4px 0 18px' }}>
        <svg viewBox="0 0 210 122" width="210" height="122" role="img" aria-label={`Health index score ${score.toFixed(1)} out of 100`}>
          <path d="M 23 105 A 82 82 0 0 1 187 105" className="gauge-track" fill="none" strokeWidth="13" strokeLinecap="round" />
          <motion.path d="M 23 105 A 82 82 0 0 1 187 105" fill="none" stroke="url(#hg)" strokeWidth="13" strokeLinecap="round"
            strokeDasharray={circ} initial={{ strokeDashoffset: circ }} whileInView={{ strokeDashoffset: circ * (1 - score / 100) }} viewport={{ once: true }} transition={{ duration: 1.1, ease }} />
          <defs><linearGradient id="hg" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#FF5C7A" /><stop offset="50%" stopColor="#FFB547" /><stop offset="100%" stopColor="#00EC97" /></linearGradient></defs>
        </svg>
        <div style={{ position: 'absolute', bottom: 4, textAlign: 'center' }}>
          <div className="num" style={{ fontSize: 42, lineHeight: 1 }}><CountUp value={score} digits={1} /></div>
          <div className="tiny tertiary" style={{ letterSpacing: '.1em', textTransform: 'uppercase' }}>sample score / 100</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div className="card-surface" style={{ padding: 12, borderRadius: 11, border: '1px solid var(--border)' }}><div className="card-title">Evidence confidence</div><div className="num" style={{ fontSize: 20, marginTop: 4 }}>{Math.round((health?.confidence ?? 0) * 100)}%</div></div>
        <div className="card-surface" style={{ padding: 12, borderRadius: 11, border: '1px solid var(--border)' }}><div className="card-title">Agents in this sample</div><div className="num" style={{ fontSize: 20, marginTop: 4 }}>{health?.fleet?.agents ?? '—'} <span className="tiny" style={{ color: 'var(--green)' }}>{health?.fleet?.active ?? 0} active</span></div></div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {(health?.components || []).map((c: any) => (
          <div key={c.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
              <span className="small muted" style={{ textTransform: 'capitalize' }}>{({activity:'Recorded actions',growth:'Change in activity',capital:'Balance changes',concentration:'How spread out activity is',retention:'Returning activity',fleet_liveness:'Agents publishing reports'} as Record<string,string>)[c.id] || c.id.replace(/_/g, ' ')}</span>
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
