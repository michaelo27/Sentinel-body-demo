'use client';
import Link from 'next/link';
import { ArrowUpRight, ArrowRight, Fingerprint, KeyRound, Radio } from 'lucide-react';
import { AgentArt } from './agent-art';
import { useJson } from '@/lib/api';

export function SignalRibbon() {
  return <div className="signal-ribbon" aria-label="Project capabilities"><span>NEAR TESTNET</span><b>✳</b><span>AI EXPLANATIONS</span><b>✳</b><span>HOLDER ACCESS</span><b>✳</b><span>YOUR NFT. YOUR AGENT.</span></div>;
}
export function SectionHeading({ label, title, text }: { label: string; title: string; text?: string }) {
  return <div className="collect-heading"><span className="eyebrow">{label}</span><h2>{title}</h2>{text && <p>{text}</p>}</div>;
}
export function BodyCard({ id = '0' }: { id?: string }) {
  const q = useJson<any>(`/api/agent/${encodeURIComponent(id)}`, {auth:false});
  const exists = !!q.data?.agent_account;
  return <article className="body-card"><div className="body-card-top"><span>SENTINEL #{id}</span><span className="collect-tag">{id === '0' ? 'GENESIS' : 'TESTNET'}</span></div><div className="body-art"><AgentArt tokenId={id} size={300}/></div><div className="body-card-info"><div><span className="small muted">{q.loading ? 'Reading chain state…' : exists ? 'Agent account' : 'State unavailable'}</span><p className="mono tiny">{exists ? q.data.agent_account : 'Retry when RPC is available'}</p></div>{exists && <Link className="round-link" href={`/agent/${id}`} aria-label={`Inspect Sentinel ${id}`}><ArrowUpRight/></Link>}</div>{(q.error || q.data?.error) && <p role="status" className="small muted">{q.error || q.data.error}. No ownership claim is made.</p>}</article>;
}
export function UtilityGrid() {
  return <div className="utility-grid">
    <article className="utility-card"><Fingerprint size={38}/><span className="eyebrow">01 / VERIFY</span><h3>A report.<br/>Not just a promise.</h3><p>See which agent published a report. Compare its fingerprint with the record stored on NEAR.</p><Link href="/proof" className="text-link">Inspect the proof <ArrowUpRight size={20}/></Link><div className="hash-art" aria-hidden="true">SHA<br/><span>256</span></div></article>
    <article className="utility-card"><Radio size={38}/><span className="eyebrow">02 / EXPLORE</span><h3>See what happened.<br/>Know what to check.</h3><p>Look up an account or transaction, follow saved balance changes and get AI help understanding the evidence.</p><Link href="/live" className="text-link">Explore the network report <ArrowUpRight size={20}/></Link><div className="wave-art" aria-hidden="true">{Array.from({length:17},(_,i)=><i key={i} style={{height: `${30 + ((i*37)%95)}px`}}/>)}</div></article>
    <article className="utility-card"><KeyRound size={38}/><span className="eyebrow">03 / OWN</span><h3>Your NFT.<br/>Your agent account.</h3><p>Each minted NFT has a NEAR agent account. Your buddy can publish a report hash using a key limited to that job.</p><Link href="/agent/0" className="text-link">Meet Genesis <ArrowUpRight size={20}/></Link><div className="utility-orb"><AgentArt size={220}/></div></article>
    <article className="utility-card utility-cta"><span className="eyebrow">ENTER THE SIGNAL</span><h3>Ready to meet<br/>your Sentinel?</h3><p>Mint a buddy to unlock the intel vault. Connecting is free; minting needs a separate wallet approval and testnet NEAR.</p><Link href="/mint" className="btn btn-primary">Explore minting <ArrowRight size={18}/></Link><span className="small muted">Research prototype · no staking or reward token</span></article>
  </div>;
}
export function Journey() {
  return <section className="collect-section wrap"><SectionHeading label="YOUR NEXT MOVE" title="Get your buddy. Put it to work."/><div className="journey-grid">{[
    ['01','Explore the collection','Meet the six artwork styles and see which token IDs remain available.','/collection'],
    ['02','Connect, then choose','Connect a testnet wallet, then approve a mint to receive your NFT and linked agent account.','/mint'],
    ['03','Open your intel vault','Confirm you own a buddy, then investigate accounts, watch balances and ask AI to explain.','/vault'],
  ].map(([n,t,d,href])=><Link className="journey-card" href={href} key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p><ArrowUpRight size={22}/></Link>)}</div></section>;
}
export function CollectionFAQ() {
  return <section className="collect-section wrap faq-section"><SectionHeading label="GOOD QUESTIONS" title="Know what you own."/><div>{[
    ['What is Sentinel Buddies?','An NFT-linked AI agent experience on NEAR testnet. Your NFT unlocks a dedicated agent account, investigation tools, balance watches and AI explanations.'],
    ['Is this the on-chain NFT image?','The Collection gallery reads registered artwork and token metadata from testnet. Each registered ID has distinct artwork. Lookup cards and agent pages read minted NFT artwork. Decorative illustrations elsewhere use the shared website character. Artwork follows the NFT when transferred; image hosting on Vercel is not guaranteed permanent.'],
    ['Does connecting unlock the vault?','No. Connect your wallet first, then confirm ownership of a Sentinel NFT. The signature unlocks your tools without moving funds.'],
    ['Are these investment or staking products?','No. This prototype has no promised returns, staking rewards or token yield. Analytics are limited measurements, not investment advice.'],
    ['What does a matching hash prove?','It proves payload consistency with a commitment—not the truth of every source observation or calculation.'],
  ].map(([q,a])=><details key={q}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}</div></section>;
}
