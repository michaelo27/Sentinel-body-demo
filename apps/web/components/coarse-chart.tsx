'use client';
import React from 'react';
import { motion } from 'framer-motion';
import { fmt } from './ui';

/** Delayed, coarse public tier: 5 buckets only, no account-level detail. */
export function CoarseChart({ points, blurred = false }: { points: any[]; blurred?: boolean }) {
  const max = Math.max(1, ...points.map((p) => Math.abs(p.value || 0)));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 132, paddingTop: 8 }} className={blurred ? 'locked-blur' : ''} aria-hidden={blurred}>
      {points.map((p, i) => (
        <div key={p.id || i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, height: '100%', justifyContent: 'flex-end' }}>
          <span className="mono tiny tertiary">{fmt(p.value, 0)}</span>
          <motion.div initial={{ height: 0 }} whileInView={{ height: `${Math.max(4, Math.abs(p.value || 0) / max * 80)}%` }} viewport={{ once: true }} transition={{ duration: .7, delay: i * .07 }}
            style={{ width: '100%', maxWidth: 54, borderRadius: '6px 6px 2px 2px', background: (p.value || 0) >= 0 ? 'linear-gradient(180deg,rgba(0,236,151,.65),rgba(0,236,151,.09))' : 'linear-gradient(180deg,rgba(255,92,122,.6),rgba(255,92,122,.08))' }} />
          <span className="tiny tertiary" style={{ textAlign: 'center', lineHeight: 1.2 }}>{p.label}</span>
        </div>
      ))}
    </div>
  );
}
