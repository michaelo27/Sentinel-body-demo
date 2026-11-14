'use client';
import Link from 'next/link';
import { useJson } from '@/lib/api';
export function CollectionVariants() {
  const q = useJson<any>('/collection-state', { auth: false, intervalMs: 60000 });
  const d = q.data;
  return <section id="character-variants" className="collect-section wrap" aria-labelledby="variants-title" style={{ scrollMarginTop: 90 }}>
    <span className="eyebrow">SENTINEL COLLECTION · ON-CHAIN ARTWORK</span>
    <h2 id="variants-title" className="h2">Same Sentinel.<br/><span style={{ color: 'var(--green)' }}>Different identities.</span></h2>
    <p className="lead">Each registered token ID has its own rendered 3D-style image. Artwork belongs to the NFT and follows it when transferred—not permanently to a wallet.</p>
    <div className="card" style={{ padding: 20, marginBottom: 24 }}>
      {q.loading && !d && <p>Reading finalized testnet state…</p>}
      {q.error && <p role="alert">{q.error} {d ? 'The cards below show the last successful reading, not current availability.' : ''}</p>}
      {d && <><strong>{q.error ? 'Last successful reading: ' : ''}{d.entries.length} registered artworks · {d.tokens.length} existing NFTs · {d.remaining} remaining token IDs</strong><p className="muted">{d.paused ? 'Minting was paused at this block.' : 'Minting was open at this block.'} Availability may change before your wallet transaction. New mints use the next token ID; you do not choose an artwork.</p><p className="small muted">Finalized block {d.block_height} · Read {new Date(d.checked_at).toLocaleString()}</p></>}
      <button className="btn btn-ghost" onClick={q.refresh}>Refresh chain state</button>
      {d && !q.error && !d.paused && d.remaining > 0 && <Link className="btn btn-primary" href="/mint" style={{ marginLeft: 12 }}>Explore minting</Link>}
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 20 }}>
      {d?.entries.map((art: any, id: number) => {
        const token = d.tokens.find((t: any) => t.token_id === String(id));
        const matches = token && token.metadata?.media === art.media && token.metadata?.media_hash === art.media_hash;
        const status = token ? (matches ? 'MINTED · METADATA MATCHES' : 'MINTED · METADATA MISMATCH') : id >= Number(d.next_token_id) ? 'REGISTERED · NOT YET MINTED' : 'RESERVED ID · NO NFT RETURNED';
        return <article className="card" key={id} style={{ overflow: 'hidden' }}>
          <img src={art.media} alt={`${art.name}, artwork registered for Sentinel #${id}`} loading="lazy" style={{ width: '100%', height: 380, objectFit: 'contain', background: '#05141b' }}/>
          <div style={{ padding: 20 }}><span className="eyebrow">#{id} · {status}</span><h3>{art.name}</h3>
            {token ? <><p className="small muted" style={{ overflowWrap: 'anywhere' }}>Owner at this block: {token.owner_id}</p><Link href={`/agent/${id}`} className="text-link">Inspect Sentinel #{id} →</Link></> : <p className="muted">Artwork reserved for this token ID. This card is not proof that an NFT has been minted.</p>}
            <details className="small muted"><summary>Registered SHA-256 (base64)</summary><p style={{ overflowWrap: 'anywhere' }}>{art.media_hash}</p></details>
          </div>
        </article>;
      })}
    </div>
    <p className="small muted" style={{ marginTop: 20 }}>Images are rendered artwork, not interactive 3D models. Media URLs and hashes are on-chain; image files are hosted on Vercel, not guaranteed permanent storage. This view compares registered metadata, not downloaded image bytes. Administrators can append artworks or upgrade the contract; six is the current registered set, not an immutable lifetime cap.</p>
  </section>;
}
