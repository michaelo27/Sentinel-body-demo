'use client';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PublicTeaser } from '@/components/public-teaser';
import { VaultGate } from '@/components/vault-gate';
import { VaultDashboard } from '@/components/dashboard';

export default function LivePage() {
  return <>
    <section className="wrap" style={{ paddingTop: 54, paddingBottom: 20 }}>
      <span className="eyebrow">Inside the intel vault</span>
      <h1 className="h2" style={{ marginTop: 10, maxWidth: 760 }}>Explore NEAR. <span className="serif" style={{ color: 'var(--text-2)' }}>Start with the evidence.</span></h1>
      <p className="lead" style={{ maxWidth: 680, marginTop: 12 }}>Browse a saved network report below. Own a Sentinel NFT? Open your vault to investigate an account, track balances and get an AI explanation of your saved observations.</p>
    </section>
    <div className="wrap" style={{paddingBottom:20}}><Link href="/vault" className="btn btn-primary">Open my intel vault <ArrowRight size={16}/></Link></div>
    <section className="wrap" style={{ paddingBottom: 20 }}><PublicTeaser /></section>
    <VaultGate compact title="Unlock the full report">{(vault) => <VaultDashboard vault={vault} />}</VaultGate>
  </>;
}
