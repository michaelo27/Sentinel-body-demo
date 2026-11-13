'use client';
import React from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { useState } from 'react';

export function fmt(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(digits);
}
export function usd(n: number | null | undefined): string {
  if (n == null) return '—';
  return `$${fmt(n, 2)}`;
}
export function shortHash(h: string | null | undefined, n = 8): string {
  if (!h) return '—';
  return `${h.slice(0, n)}…${h.slice(-6)}`;
}
export function relativeTime(iso: string | number | null | undefined): string {
  if (!iso) return '—';
  const t = typeof iso === 'number' ? iso : Date.parse(iso);
  if (!Number.isFinite(t)) return '—';
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
export function absoluteTime(iso: string | number | null | undefined): string {
  if (!iso) return '—';
  const t = typeof iso === 'number' ? iso : Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toUTCString() : '—';
}

export function TimeAgo({ iso, className = '' }: { iso: string | number | null; className?: string }) {
  return <span className={className} title={absoluteTime(iso)}>{relativeTime(iso)}</span>;
}

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      aria-label={label || `Copy ${value.slice(0, 12)}`}
      className="btn btn-ghost btn-sm"
      style={{ minHeight: 30, padding: '0 9px' }}
      onClick={async () => {
        try { await navigator.clipboard.writeText(value); setOk(true); setTimeout(() => setOk(false), 1400); } catch { /* ignore */ }
      }}
    >{ok ? <Check size={13} color="var(--green)" /> : <Copy size={13} />}</button>
  );
}

export function HashRow({ label, value, href }: { label: string; value: string | null; href?: string }) {
  return (
    <div className="kv" style={{ alignItems: 'center' }}>
      <span className="kv-k">{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        {value ? <>
          <span className="hash" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 210 }} title={value}>{shortHash(value, 14)}</span>
          <CopyButton value={value} />
          {href && <a href={href} target="_blank" rel="noreferrer" aria-label="Open in explorer" className="btn btn-ghost btn-sm" style={{ minHeight: 30, padding: '0 9px' }}><ExternalLink size={13} /></a>}
        </> : <span className="kv-v tertiary">not available</span>}
      </span>
    </div>
  );
}

export function Chip({ children, tone = '', dot = false }: { children: React.ReactNode; tone?: string; dot?: boolean }) {
  return <span className={`chip ${tone ? `chip-${tone}` : ''}`}>{dot && <span className="dot dot-live" />}{children}</span>;
}

export function Card({ children, className = '', style, title, right }: { children: React.ReactNode; className?: string; style?: React.CSSProperties; title?: string; right?: React.ReactNode }) {
  return (
    <section className={`card ${className}`} style={style}>
      {(title || right) && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        {title && <h3 className="card-title">{title}</h3>}
        {right}
      </div>}
      {children}
    </section>
  );
}

export function Skeleton({ h = 14, w = '100%' }: { h?: number; w?: string | number }) {
  return <div className="skeleton" style={{ height: h, width: w }} aria-hidden="true" />;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div style={{ textAlign: 'center', padding: '52px 20px' }}>
      <div className="orb-frame" style={{ width: 66, height: 66, margin: '0 auto 20px', opacity: .45 }} />
      <h3 className="h3" style={{ marginBottom: 8 }}>{title}</h3>
      <p className="small muted" style={{ maxWidth: 380, margin: '0 auto 20px', lineHeight: 1.6 }}>{body}</p>
      {action}
    </div>
  );
}

export function Badge({ kind, children }: { kind: 'fact' | 'assumption' | 'measured' | 'stale' | 'replay'; children?: React.ReactNode }) {
  const map = {
    fact: ['chip-green', 'VERIFIED'],
    assumption: ['chip-amber', 'ASSUMPTION'],
    measured: ['chip-violet', 'MEASURED'],
    stale: ['chip-amber', 'STALE'],
    replay: ['chip-violet', 'REPLAY'],
  } as const;
  const [cls, text] = map[kind];
  return <span className={`chip ${cls}`}>{children || text}</span>;
}

export function CountUp({ value, digits = 0, prefix = '', suffix = '' }: { value: number; digits?: number; prefix?: string; suffix?: string }) {
  const [shown, setShown] = useState(0);
  React.useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(value); return; }
    let frame = 0; const start = performance.now(); const dur = 900;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setShown(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{prefix}{shown.toFixed(digits)}{suffix}</>;
}
