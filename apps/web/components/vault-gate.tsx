'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { Lock, Wallet, ShieldCheck, KeyRound, ArrowRight, Check, ExternalLink, Unlock, RefreshCw, AlertTriangle } from 'lucide-react';
import { useSentinel } from '../app/providers';
import { useJson } from '@/lib/api';
import { useOwnershipProof } from '@/lib/ownership';
import { Card, Chip, Skeleton, EmptyState, shortHash } from './ui';
import { AgentArt } from './agent-art';

const DEMO_ACCOUNTS = [
  { id: 'sntl-owner-02e90eacb8.testnet', label: 'Organizer / Genesis holder', note: 'Holds token #0' },
  { id: 'sntl-peer-02e90eacb8.testnet', label: 'Second test account', note: 'For the transfer demo' },
];

const STEPS = [
  { key: 'idle', label: 'Identify account' },
  { key: 'challenge', label: 'Issue challenge' },
  { key: 'signing', label: 'Prove ownership' },
  { key: 'checking', label: 'Check on-chain' },
  { key: 'done', label: 'Vault unlocked' },
];

export function VaultGate({ children, title = 'Holder vault', compact = false }: { children: (vault: any) => React.ReactNode; title?: string; compact?: boolean }) {
  const s = useSentinel();
  const { stage, result, prove, reset } = useOwnershipProof();
  useEffect(() => { reset(); }, [s.accountId]);
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const vault = useJson<any>(s.scope === 'holder' ? '/api/vault/latest' : null, { intervalMs: 30000, auth: true });

  useEffect(() => {
    if (vault.error && /revoked|session|expired|holder/i.test(vault.error)) {
      setRevoked(true);
      s.setScope('preview');
    }
  }, [vault.error]);

  if (s.scope === 'holder' && vault.data) {
    return <AnimatePresence mode="wait"><motion.div key="vault" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .35 }}>{children(vault.data)}</motion.div></AnimatePresence>;
  }
  if (s.scope === 'holder') {
    return <div className="wrap section"><Card>{vault.error ? <EmptyState title="Holder session needs renewal" body={vault.error} action={<button className="btn btn-primary" onClick={() => { s.setScope('preview'); vault.refresh(); }}>Prove again</button>} /> : <div style={{ display: 'grid', gap: 12, padding: 20 }}><Skeleton h={20} w="30%" /><Skeleton h={80} /><Skeleton h={40} /></div>}</Card></div>;
  }

  const doWallet = async () => {
    setBusy(true);
    try { await s.connectWallet(); toast.success('Wallet connected. Now prove ownership.'); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  const doDemo = async (id: string) => {
    setBusy(true);
    try { await s.demoSession(id); toast.success(`Preview session for ${id}. Prove ownership to unlock.`); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  const doProve = async () => {
    const r = await prove();
    if (r.error) toast.error(r.error); else toast.success(`Ownership proven via ${r.method}. Vault unlocked.`);
  };

  const stepIndex = !s.accountId ? 0 : stage === 'error' ? 2 : Math.max(0, STEPS.findIndex((x) => x.key === stage));

  return (
    <section className="wrap section" style={compact ? { paddingTop: 40 } : undefined}>
      <div className="bento" style={{ alignItems: 'stretch' }}>
        <Card className="col-7" style={{ padding: 30 }}>
          {revoked && <div className="chip chip-amber" style={{ height: 'auto', padding: 10, marginBottom: 16, whiteSpace: 'normal' }}><AlertTriangle size={14} /> On-chain holder check revoked this session. That is the access model working — prove again with the current owner.</div>}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <div><span className="eyebrow">Gated by the NFT</span><h2 className="h2" style={{ marginTop: 8 }}>{title}</h2></div>
            <Chip tone="violet"><Lock size={12} /> HOLDER ONLY</Chip>
          </div>
          <p className="lead" style={{ maxWidth: 560, marginTop: 14 }}>A short-lived session is issued only after a valid ownership proof and an on-chain <span className="mono tiny">is_holder</span> view call. Holder status is re-checked at most every 30 seconds, so a transfer revokes access.</p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '22px 0' }}>
            {STEPS.map((x, i) => <span key={x.key} className={`chip ${i <= stepIndex ? 'chip-green' : ''}`} style={{ opacity: i <= stepIndex ? 1 : .5 }}>{i < stepIndex ? <Check size={11} /> : null}{i + 1}. {x.label}</span>)}
          </div>

          {!s.accountId ? <>
            <div className="card-title" style={{ marginBottom: 12 }}>1 · Connect a testnet wallet</div>
            <button className="btn btn-primary" onClick={doWallet} disabled={busy || s.connecting}><Wallet size={16} /> {busy || s.connecting ? 'Connecting…' : 'Connect wallet (Meteor-friendly)'}</button>
            <p className="small muted" style={{marginTop:20}}>The hosted demo supports wallet ownership proof only. Organizer demo-account login is disabled.</p>
          </> : <>
            <div className="card-surface" style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div><div className="card-title">Connected account</div><div className="mono small" style={{ marginTop: 5 }}>{s.accountId}</div></div>
              <div style={{ display: 'flex', gap: 6 }}><Chip tone={s.mode === 'demo' ? 'amber' : 'green'}>{s.mode === 'demo' ? 'DEMO SESSION' : 'WALLET'}</Chip><button className="btn btn-ghost btn-sm" onClick={s.logout}>Change</button></div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
              <button className="btn btn-primary" onClick={doProve} disabled={stage === 'signing' || stage === 'checking' || stage === 'challenge'}>
                {stage === 'signing' || stage === 'checking' ? <><RefreshCw size={15} className="animate-spin" /> {stage === 'signing' ? 'Waiting for signature…' : 'Checking on-chain…'}</> : <><ShieldCheck size={16} /> Prove ownership & unlock</>}
              </button>
              <Link href="/mint" className="btn btn-ghost">Need an NFT? Mint <ArrowRight size={14} /></Link>
            </div>
            {result.error && <p className="small" style={{ color: 'var(--rose)', marginTop: 12 }} role="alert">{result.error}</p>}
            {result.tx && <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><Chip tone="green"><Check size={11} /> REAL PROOF TX</Chip><span className="mono tiny">{shortHash(result.tx, 12)}</span><a href={result.explorer_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm"><ExternalLink size={12} /> Explorer</a></div>}
            <div className="tiny tertiary" style={{ marginTop: 16, lineHeight: 1.6 }}>Wallet path: NEP-413 <span className="mono">signMessage</span> with a full-access key, verified against <span className="mono">view_access_key</span>. Client-supplied receipt authentication is disabled on the hosted gateway. No gas is spent on the signature path.</div>
          </>}
        </Card>

        <motion.div className="col-5" initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .6 }}>
          <Card className="locked" style={{ height: '100%', minHeight: 420, padding: 0, display: 'grid', placeItems: 'center' }}>
            <div className="locked-blur" style={{ width: '100%', padding: 26, display: 'grid', gap: 14 }}>
              <div className="card-title">LIVE FULL-RESOLUTION INTELLIGENCE</div>
              <div className="num" style={{ fontSize: 40 }}>+444,331.42</div>
              {[70, 45, 88, 60, 75, 50].map((w, i) => <div key={i} className="skeleton" style={{ height: i === 5 ? 90 : 16, width: `${w}%` }} />)}
            </div>
            <div className="locked-overlay">
              <AgentArt tokenId="0" size={112} />
              <div style={{ width: 44, height: 44, borderRadius: 13, display: 'grid', placeItems: 'center', background: 'rgba(0,236,151,.1)', border: '1px solid rgba(0,236,151,.3)' }}><KeyRound size={19} color="var(--green)" /></div>
              <h3 className="h3" style={{ textAlign: 'center' }}>A body with a key</h3>
              <p className="small muted" style={{ textAlign: 'center', maxWidth: 280, lineHeight: 1.6, margin: 0 }}>The NFT is the key. The agent account obeys the holder; the vault obeys the chain.</p>
              <Chip tone="green"><Unlock size={12} /> 10-MINUTE SESSION</Chip>
            </div>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
