'use client';
import { useJson } from '@/lib/api';

export async function assertMintAvailable() {
  const r = await fetch('/collection-state', { cache: 'no-store', signal: AbortSignal.timeout(15000) });
  const d = await r.json();
  if (!r.ok || !Array.isArray(d.entries) || !Number.isSafeInteger(Number(d.next_token_id)) || typeof d.paused !== 'boolean') throw new Error('Live mint availability cannot be verified. No wallet transaction requested.');
  if (d.paused) throw new Error('Minting is paused. No wallet transaction requested.');
  if (d.remaining <= 0 || !d.entries[Number(d.next_token_id)]) throw new Error('The registered artwork set is sold out. No wallet transaction requested.');
  return d;
}

export function MintAvailability() {
  const q = useJson<any>('/collection-state', { auth: false, intervalMs: 30000 });
  const d = q.data;
  const art = d?.entries?.[Number(d.next_token_id)];
  return <section className="card" aria-label="Live mint availability" style={{ padding: 24, margin: '24px 0', display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
    {art && !q.error && <img src={art.media} alt={`Next registered artwork: ${art.name}`} style={{ width: 150, height: 150, objectFit: 'contain', borderRadius: 16 }}/>}<div style={{ flex: 1, minWidth: 220 }}>
      <span className="eyebrow">REGISTERED COLLECTION · LIVE TESTNET READ</span>
      {q.loading && !d && <p>Checking mint availability…</p>}
      {q.error ? <p role="alert">Availability unavailable. Mint submission must pass a fresh chain check before your wallet is opened.</p> : d && <>
        <h3>{d.paused ? 'Minting paused' : d.remaining <= 0 ? 'Registered artwork set sold out' : `${d.remaining} token IDs remaining`}</h3>
        <p>{d.entries.length} registered artworks · {d.tokens.length} existing NFTs</p>
        {art && <p>Next at this block: <strong>#{d.next_token_id} — {art.name}</strong></p>}
        <p className="small muted">Finalized block {d.block_height} · Read {new Date(d.checked_at).toLocaleString()}</p>
      </>}
      <p className="small muted">Artwork is assigned in token-ID order, not chosen by wallet. Another mint can change the next ID before your transaction executes. Connecting a wallet does not mint. Testnet NEAR is required; no returns are promised.</p>
      <button type="button" className="btn btn-ghost" onClick={q.refresh}>Refresh availability</button>
    </div>
  </section>;
}
