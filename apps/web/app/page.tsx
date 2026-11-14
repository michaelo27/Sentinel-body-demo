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
    <section className="collect-hero"><div className="hero-globe" aria-hidden="true"/><div className="wrap hero-content"><span className="collect-tag">SENTINEL BUDDIES / NEAR TESTNET</span><h1>Meet your buddy.<br/><span>Unlock the intel.</span></h1><p className="hero-deck">More than an NFT. Your gateway to an agent account,<br className="desktop-only"/> verifiable intelligence, and a story written on-chain.</p><div className="hero-actions"><Link href="/collection" className="btn btn-primary">Explore the collection <ArrowUpRight size={20}/></Link><Link href="/proof" className="btn btn-ghost">Verify a snapshot <ArrowRight size={18}/></Link></div>
      <div className="hero-showcase"><div className="hero-caption"><span className="eyebrow">THE FIRST SENTINEL</span><h2>GENESIS<br/>BUDDY #000</h2><p>Your own agent account.<br/>AI explanations.<br/>Reports you can check.</p><Link className="text-link" href="/agent/0">Meet Genesis <ArrowUpRight size={18}/></Link></div><div className="hero-body"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><AgentArt size={460}/><span className="orb-label">SENTINEL CHARACTER · WEBSITE ART</span></div><div className="hero-facts"><div><strong>SHA-256</strong><span>Check who published a report</span></div><div><strong>TESTNET</strong><span>No mainnet mint payment</span></div><div><strong>{quote.data?.mint_cost_near != null ? Number(quote.data.mint_cost_near).toFixed(3) : '—'} <small>NEAR</small></strong><span>{quote.data?.mint_cost_near != null ? 'Current testnet mint quote · not a connection fee' : 'Mint quote unavailable until RPC responds'}</span></div></div></div>
    </div></section>
    <SignalRibbon/>
    <section className="collect-section wrap"><SectionHeading label="MEET THE COLLECTION" title="Mint an NFT. Unlock an AI agent." text="Choose a buddy. Each minted NFT comes with its own NEAR agent account and access to the intel vault."/><div className="genesis-feature"><BodyCard/><div className="feature-story"><span className="collect-tag">COLLECTIBLE × INTELLIGENCE</span><h3>A collectible.<br/><span>A useful companion.</span></h3><p>Investigate accounts, watch balance changes and ask AI what the evidence tells you. Your agent can publish a report fingerprint you can check on-chain.</p><div className="feature-lines"><span>01 / Dedicated agent account</span><span>02 / AI explanations with sources</span><span>03 / Private tools for NFT holders</span></div><Link href="/collection" className="btn btn-primary">Enter the collection <ArrowUpRight size={18}/></Link></div></div></section>
    <section className="collect-section wrap"><SectionHeading label="BUILT FOR CURIOSITY" title="Unlock the possibilities." text="Find out who can act on an account, follow changes and make sense of the results."/><UtilityGrid/></section>
    <section className="collect-section wrap"><SectionHeading label="THE INTELLIGENCE LAYER" title="A look inside the intel vault." text="Preview a saved network report below. NFT holders also get account investigations, watchlists and AI explanations in the vault."/><PublicTeaser/></section>
    <Journey/><CollectionFAQ/>
    <section className="wrap"><div className="collect-final"><span className="eyebrow">YOUR NEXT CHAPTER</span><h2>Step into<br/><span>the signal.</span></h2><p>Mint an NFT. Get an agent. Start exploring NEAR.</p><Link href="/collection" className="btn btn-primary">Find your Sentinel <ArrowUpRight size={20}/></Link></div></section>
  </div>;
}
