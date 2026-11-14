'use client';
import Link from 'next/link';
import { ArrowUpRight, ArrowRight, Fingerprint, KeyRound, Radio } from 'lucide-react';
import { AgentArt } from './agent-art';
import { useJson } from '@/lib/api';

export function SignalRibbon() {
  return <div className="signal-ribbon" aria-label="Project capabilities"><span>NEAR TESTNET</span><b>✳</b><span>VERIFIABLE SNAPSHOTS</span><b>✳</b><span>HOLDER ACCESS</span><b>✳</b><span>YOUR BODY. YOUR SIGNAL.</span></div>;
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
    <article className="utility-card"><Fingerprint size={38}/><span className="eyebrow">01 / VERIFY</span><h3>Not just a picture.<br/>A proof you can check.</h3><p>Recompute snapshot hashes in your browser and compare them with public testnet commitments.</p><Link href="/proof" className="text-link">Inspect the proof <ArrowUpRight size={20}/></Link><div className="hash-art" aria-hidden="true">SHA<br/><span>256</span></div></article>
    <article className="utility-card"><Radio size={38}/><span className="eyebrow">02 / EXPLORE</span><h3>Follow the signal.<br/>See the evidence.</h3><p>Explore balance changes, builder cost estimates and a fleet health proxy. Sources and limitations stay visible.</p><Link href="/live" className="text-link">Explore public intelligence <ArrowUpRight size={20}/></Link><div className="wave-art" aria-hidden="true">{Array.from({length:17},(_,i)=><i key={i} style={{height: `${30 + ((i*37)%95)}px`}}/>)}</div></article>
    <article className="utility-card"><KeyRound size={38}/><span className="eyebrow">03 / OWN</span><h3>A body with<br/>a dedicated account.</h3><p>Inspect the agent’s key permissions and history. NFT ownership gates access; off-chain hosting remains separate.</p><Link href="/agent/0" className="text-link">Meet Genesis <ArrowUpRight size={20}/></Link><div className="utility-orb"><AgentArt size={220}/></div></article>
    <article className="utility-card utility-cta"><span className="eyebrow">ENTER THE SIGNAL</span><h3>Ready to meet<br/>your Sentinel?</h3><p>Explore the collection first. Minting is an explicit testnet transaction, separate from connecting your wallet.</p><Link href="/mint" className="btn btn-primary">Explore minting <ArrowRight size={18}/></Link><span className="small muted">Research prototype · no staking or reward token</span></article>
  </div>;
}
export function Journey() {
  return <section className="collect-section wrap"><SectionHeading label="YOUR NEXT MOVE" title="Three steps. One Sentinel."/><div className="journey-grid">{[
    ['01','Explore the collection','Inspect the agent, its recorded history and the public data before deciding.','/collection'],
    ['02','Connect, then choose','Use a testnet wallet. Any mint transaction is a separate, deliberate approval.','/mint'],
    ['03','Prove and verify','Holder access needs verified ownership. Public hashes remain open to everyone.','/proof'],
  ].map(([n,t,d,href])=><Link className="journey-card" href={href} key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p><ArrowUpRight size={22}/></Link>)}</div></section>;
}
export function CollectionFAQ() {
  return <section className="collect-section wrap faq-section"><SectionHeading label="GOOD QUESTIONS" title="Know what you own."/><div>{[
    ['What is Sentinel Buddies?','A testnet NFT linked to an agent account and holder-gated intelligence. A separate off-chain worker collects and computes data.'],
    ['Is this the on-chain NFT image?','The Collection gallery reads registered artwork and token metadata from testnet. Each registered ID has distinct artwork. Decorative illustrations and lookup cards may still use the shared website character. Artwork follows the NFT when transferred; image hosting on Vercel is not guaranteed permanent.'],
    ['Does connecting unlock the vault?','No. Wallet connection and verified NFT ownership are different steps. The receipt shortcut is disabled; wallet compatibility is still being validated.'],
    ['Are these investment or staking products?','No. This prototype has no promised returns, staking rewards or token yield. Analytics are limited measurements, not investment advice.'],
    ['What does a matching hash prove?','It proves payload consistency with a commitment—not the truth of every source observation or calculation.'],
  ].map(([q,a])=><details key={q}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}</div></section>;
}
