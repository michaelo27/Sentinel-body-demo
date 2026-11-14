'use client';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { AgentArt } from '@/components/agent-art';
import { PublicTeaser } from '@/components/public-teaser';
import { SignalRibbon, SectionHeading, BodyCard, UtilityGrid, Journey, CollectionFAQ } from '@/components/collection-design';
import { useJson } from '@/lib/api';

export default function Home() {
  const quote = useJson<any>('/api/mint/quote', {auth:false});
  return <div className="collection-site">
    <section className="collect-hero"><div className="hero-globe" aria-hidden="true"/><div className="wrap hero-content"><span className="collect-tag">SENTINEL BUDDIES / NEAR TESTNET</span><h1>Meet your buddy.<br/><span>Unlock the signal.</span></h1><p className="hero-deck">More than a collectible. Your gateway to an agent account,<br className="desktop-only"/> verifiable intelligence, and a story written on-chain.</p><div className="hero-actions"><Link href="/collection" className="btn btn-primary">Explore the collection <ArrowUpRight size={20}/></Link><Link href="/proof" className="btn btn-ghost">Verify a snapshot <ArrowRight size={18}/></Link></div>
      <div className="hero-showcase"><div className="hero-caption"><span className="eyebrow">THE FIRST SENTINEL</span><h2>GENESIS<br/>BODY #000</h2><p>A dedicated account.<br/>A public history.<br/>A signal you can inspect.</p><Link className="text-link" href="/agent/0">Meet Genesis <ArrowUpRight size={18}/></Link></div><div className="hero-body"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><AgentArt size={460}/><span className="orb-label">SENTINEL CHARACTER · WEBSITE ART</span></div><div className="hero-facts"><div><strong>SHA-256</strong><span>Publicly verifiable commitments</span></div><div><strong>TESTNET</strong><span>No mainnet mint payment</span></div><div><strong>{quote.data?.mint_cost_near != null ? Number(quote.data.mint_cost_near).toFixed(3) : '—'} <small>NEAR</small></strong><span>{quote.data?.mint_cost_near != null ? 'Current testnet mint quote · not a connection fee' : 'Mint quote unavailable until RPC responds'}</span></div></div></div>
    </div></section>
    <SignalRibbon/>
    <section className="collect-section wrap"><SectionHeading label="MEET THE COLLECTION" title="A body you collect. A signal you verify." text="Start with Genesis. Inspect what exists—not invented rarity scores or sold-out counters."/><div className="genesis-feature"><BodyCard/><div className="feature-story"><span className="collect-tag">COLLECTIBLE × INTELLIGENCE</span><h3>Less speculation.<br/><span>More inspection.</span></h3><p>Every claim should lead somewhere. Follow the account, read the commitments, and check the bytes yourself.</p><div className="feature-lines"><span>01 / Dedicated agent account</span><span>02 / Public commitment history</span><span>03 / Verified holder access</span></div><Link href="/collection" className="btn btn-primary">Enter the collection <ArrowUpRight size={18}/></Link></div></div></section>
    <section className="collect-section wrap"><SectionHeading label="BUILT FOR CURIOSITY" title="Unlock the possibilities." text="Real utility, plainly explained. No invented rewards or promises of returns."/><UtilityGrid/></section>
    <section className="collect-section wrap"><SectionHeading label="THE INTELLIGENCE LAYER" title="A glimpse of the signal." text="Delayed public observations. Check snapshot age, source status and methodology before interpreting any number."/><PublicTeaser/></section>
    <Journey/><CollectionFAQ/>
    <section className="wrap"><div className="collect-final"><span className="eyebrow">YOUR NEXT CHAPTER</span><h2>Step into<br/><span>the signal.</span></h2><p>Explore first. Verify always.</p><Link href="/collection" className="btn btn-primary">Find your Sentinel <ArrowUpRight size={20}/></Link></div></section>
  </div>;
}
