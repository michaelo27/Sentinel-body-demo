'use client';
import React, { useState } from 'react';
import { useJson } from '@/lib/api';

/** No token ID: decorative website character. Explicit ID: actual NFT metadata only. */
export function AgentArt({ tokenId, size = 280, className = '' }: { tokenId?: string; size?: number; className?: string }) {
  const hasId = tokenId !== undefined;
  const q = useJson<any>(hasId ? '/collection-state' : null, { auth: false, intervalMs: hasId ? 60000 : undefined });
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const token = q.data?.tokens?.find((t: any) => t.token_id === tokenId);
  const media = token?.metadata?.media;
  const safeMedia = typeof media === 'string' && /^https:\/\//.test(media) ? media : null;
  const unavailable = q.error ? 'Artwork state unavailable' : q.loading && !q.data ? 'Reading NFT artwork…' : !token ? 'No minted NFT returned for this ID' : !safeMedia ? 'NFT has no supported HTTPS artwork' : failedImage === safeMedia ? 'Artwork file unavailable' : null;
  if (!hasId) return <div className={`sentinel-character ${className}`} style={{ width: size, height: size, flex: '0 0 auto' }} role="img" aria-label="Sentinel Buddies decorative website character"><img src="/artwork/sentinel-character.webp" alt="" width={482} height={1014} decoding="async" /></div>;
  return <figure className={`sentinel-character ${className}`} style={{ width: size, height: size, flex: '0 0 auto', margin: 0, flexDirection: 'column', gap: 8 }}>
    {unavailable ? <div role="status" style={{ padding: 12, textAlign: 'center', fontSize: 12, position: 'relative', zIndex: 2 }}><p>Sentinel #{tokenId}</p><p>{unavailable}</p><button type="button" className="btn btn-ghost btn-sm" onClick={() => { setFailedImage(null); q.refresh(); }}>Retry artwork</button></div> : <>
      <img key={safeMedia} src={safeMedia!} alt={`Sentinel Buddies #${tokenId} — image from on-chain NFT metadata`} decoding="async" onError={() => setFailedImage(safeMedia)} style={{ minHeight: 0, flex: 1, objectFit: 'contain' }}/>
      <figcaption className="tiny muted" style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>NFT #{tokenId} · block {q.data.block_height}</figcaption>
    </>}
  </figure>;
}
