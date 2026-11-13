'use client';
import React from 'react';

/** Selected website presentation artwork; NOT the deployed NFT metadata image. */
export function AgentArt({ tokenId = '0', size = 280, className = '' }: { tokenId?: string; size?: number; className?: string }) {
  return (
    <div className={`sentinel-character ${className}`} style={{ width: size, height: size, flex: '0 0 auto' }} role="img" aria-label={`Sentinel Body #${tokenId}, shared website character artwork; on-chain media unchanged`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/artwork/sentinel-character.webp" alt="" width={482} height={1014} decoding="async" />
    </div>
  );
}
