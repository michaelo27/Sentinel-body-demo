'use client';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PublicTeaser } from '@/components/public-teaser';
import { VaultGate } from '@/components/vault-gate';
import { VaultDashboard } from '@/components/dashboard';

export default function LivePage() {
  return <>
    <section className="wrap" style={{ paddingTop: 54, paddingBottom: 20 }}>
      <span className="eyebrow">Live intelligence</span>
      <h1 className="h2" style={{ marginTop: 10, maxWidth: 760 }}>One real snapshot. <span className="serif" style={{ color: 'var(--text-2)' }}>Two honest tiers.</span></h1>
      <p className="lead" style={{ maxWidth: 680, marginTop: 12 }}>Non-holders see a delayed, coarse preview and the public on-chain hash. Holders see the live full-resolution dashboard with every source query, pinned block and labelled assumption.</p>
    </section>
    <section className="wrap" style={{ paddingBottom: 20 }}><PublicTeaser /></section>
    <VaultGate compact title="Unlock the live tier">{(vault) => <VaultDashboard vault={vault} />}</VaultGate>
  </>;
}
