'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Small fetch hook: no SWR dependency, 30s refresh, explicit loading/error/empty states. */
export function useJson<T = any>(url: string | null, opts: { intervalMs?: number; auth?: boolean; headers?: Record<string, string> } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!url);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const alive = useRef(true);

  const load = useCallback(async () => {
    if (!url) { setLoading(false); return; }
    try {
      const h: Record<string, string> = { ...(opts.headers || {}) };
      if (opts.auth !== false) {
        try { const raw = localStorage.getItem('sentinel.session.v1'); if (raw) { const t = JSON.parse(raw).token; if (t) h.Authorization = `Bearer ${t}`; } } catch { /* ignore */ }
      }
      const res = await fetch(url, { headers: h, cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      if (alive.current) { setData(j as T); setError(null); setUpdatedAt(Date.now()); }
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [url, opts.auth, JSON.stringify(opts.headers || {})]);

  useEffect(() => {
    alive.current = true;
    setLoading(!!url);
    load();
    const id = opts.intervalMs ? setInterval(load, opts.intervalMs) : null;
    return () => { alive.current = false; if (id) clearInterval(id); };
  }, [load, opts.intervalMs]);

  return { data, error, loading, refresh: load, updatedAt };
}

export function publicSnapshotUrl(id: string) { return `/api/public/snapshot/${encodeURIComponent(id)}`; }
export function explorerTx(hash: string) { return `https://testnet.nearblocks.io/txns/${hash}`; }
export function explorerAccount(id: string) { return `https://testnet.nearblocks.io/accounts/${id}`; }
