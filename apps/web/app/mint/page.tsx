'use client';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import { Wallet, ArrowRight, ArrowLeftRight, Check, ExternalLink, KeyRound, Cpu, ShieldCheck, Unlock, RefreshCw, Sparkles, AlertTriangle } from 'lucide-react';
import { useSentinel } from '@/app/providers';
import { useOwnershipProof } from '@/lib/ownership';
import { useJson, explorerTx } from '@/lib/api';
import { AgentArt } from '@/components/agent-art';
import { TransferDemo } from '@/components/transfer-demo';
import { MintAvailability, assertMintAvailable } from '@/components/mint-availability';
import { Card, Chip, shortHash, Skeleton, Badge } from '@/components/ui';

const BIRTH = [
  { t: 'Attached testnet NEAR', d: '1.87312 free testnet NEAR covers account creation, controller wasm storage and seed fuel.' },
  { t: 'Creating agent subaccount', d: 'agent-<id>.sntl-02e90eacb8.testnet is created as a child of the NFT contract.' },
  { t: 'Deploying controller wasm', d: 'A 120 KB optimized controller contract is deployed; its only parent is sntl-02e90eacb8.testnet.' },
  { t: 'Adding restricted worker key', d: 'One function-call key: publish_snapshot only, 0.25 NEAR gas allowance, no FullAccess.' },
  { t: 'Minting the NFT', d: 'The private callback mints the token, registers the agent and refunds any unused deposit.' },
];

export default function MintPage() {
  const s = useSentinel();
  const { stage, result, prove } = useOwnershipProof();
  const quote = useJson<any>('/api/mint/quote', { auth: false, intervalMs: 60000 });
  const [busy, setBusy] = useState(false);
  const [birthStep, setBirthStep] = useState(-1);
  const [mint, setMint] = useState<any>(null);
  const [error, setError] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const timer = useRef<any>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const cost = quote.data?.mint_cost_near;
  const nextId = quote.data?.next_token_id ?? null;

  const connect = async () => {
    setBusy(true); setError('');
    try { await s.connectWallet(); toast.success('Wallet connected.'); }
    catch (e) { setError((e as Error).message); toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  const demo = async (accountId: string) => {
    setBusy(true); setError('');
    try { await s.demoSession(accountId); toast.success(`Demo preview session: ${accountId}`); }
    catch (e) { setError((e as Error).message); toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const startBirth = () => { setBirthStep(-1); };
  const stopBirth = () => { if (timer.current) { clearInterval(timer.current); timer.current = null; } setBirthStep(-1); };

  const doMint = async () => {
    if (!s.accountId) { setError('Connect a wallet or choose a demo account first.'); return; }
    setBusy(true); setError(''); setMint(null); startBirth();
    try {
      await assertMintAvailable();
      if (s.mode === 'demo') {
        const r = await s.api<any>('/api/demo/mint', { method: 'POST', body: JSON.stringify({ accountId: s.accountId }) });
        if (!r.tx) throw new Error(r.error || 'Mint did not return a transaction hash.');
        setMint(r);
        toast.success(`Token #${r.token_id} minted to ${r.owner}`);
      } else {
        if (cost == null) throw new Error('Mint quote unavailable.');
        const yocto = (BigInt(Math.round(cost * 1e6)) * 10n ** 18n).toString();
        const tx = await s.callContract({ methodName: 'mint_agent', args: { receiver_id: s.accountId }, gas: '300000000000000', deposit: yocto });
        const hash = typeof tx === 'string' ? tx : tx?.transaction?.hash || tx?.transaction_hash || null;
        if (!hash) throw new Error('Wallet did not return a transaction hash. Inspect wallet history before retrying.');
        const failure = tx?.status?.Failure || tx?.receipts_outcome?.find((r: any) => r.outcome?.status?.Failure)?.outcome?.status?.Failure;
        if (failure) throw new Error(`Mint execution failed. Transaction: ${hash}. ${JSON.stringify(failure)}`);
        let agentAccount: string | null = null;
        const tid = String(nextId ?? '?');
        for (let i = 0; i < 20 && tid !== '?'; i++) {
          const r = await fetch(`/api/agent/${tid}`).then((x) => x.json()).catch(() => null);
          if (r?.agent_account && r.owner_id === s.accountId) { agentAccount = r.agent_account; break; }
          await new Promise((res) => setTimeout(res, 1500));
        }
        if (!agentAccount) throw new Error(`Transaction ${hash} returned, but ownership/provisioning is not yet confirmed. Inspect wallet history and chain state before retrying.`);
        setMint({ token_id: tid, owner: s.accountId, agent_account: agentAccount, tx: hash, explorer_url: explorerTx(hash), note: 'Signed by your wallet; real testnet transaction.' });
        toast.success(`Mint transaction submitted: token #${tid}`);
      }
    } catch (e) { setError((e as Error).message); toast.error((e as Error).message); }
    finally { stopBirth(); setBusy(false); }
  };

  const doProve = async () => {
    const r = await prove();
    if (r.error) { setError(r.error); toast.error(r.error); }
    else { setUnlocked(true); setError(''); toast.success('Ownership proven. The vault is unlocked.'); }
  };

  const step = !s.accountId ? 0 : !mint ? 1 : !unlocked ? 2 : 3;

  return (
    <div className="wrap" style={{ paddingTop: 48, paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div><span className="eyebrow">YOUR NFT IS THE START</span><h1 className="h2" style={{ marginTop: 10 }}>Mint an NFT. <span className="serif" style={{ color: 'var(--green)' }}>Unlock an AI agent.</span></h1><p className="lead" style={{ maxWidth: 680, marginTop: 12 }}>One mint gives you a Sentinel NFT and its own NEAR agent account. Confirm ownership to open the intel vault: investigate accounts, watch balances and ask AI to explain your saved evidence.</p></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Chip tone="green"><span className="dot dot-live" />NEAR TESTNET</Chip><Chip>FREE FAUCET NEAR</Chip></div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '28px 0 20px' }}>
        {['Connect / identify', 'Mint agent account', 'Prove ownership', 'Vault unlocked'].map((x, i) => <span key={x} className={`chip ${i <= step ? 'chip-green' : ''}`} style={{ opacity: i <= step ? 1 : .55 }}>{i < step ? <Check size={11} /> : null}{i + 1}. {x}</span>)}
      </div>

      <MintAvailability />
      <div className="bento" style={{ rowGap: 16 }}>
        <Card className="col-7" style={{ padding: 28 }}>
          {!s.accountId ? <>
            <div className="card-title">Step 1 · Identify the future owner</div>
            <h3 className="h3" style={{ marginTop: 10 }}>Connect a testnet wallet…</h3>
            <p className="small muted" style={{ lineHeight: 1.6, maxWidth: 520 }}>Wallet Selector is configured for Meteor-friendly wallets on testnet. Your account needs about {cost?.toFixed?.(5) || '1.87312'} free testnet NEAR for the mint deposit.</p>
            <button className="btn btn-primary" onClick={connect} disabled={busy || s.connecting}><Wallet size={16} /> {busy || s.connecting ? 'Connecting…' : 'Connect wallet'}</button>
            <div className="hairline" style={{ margin: '24px 0' }} />
            <h3 className="h3">…or use the no-wallet demo path</h3>
            <p className="small muted" style={{ lineHeight: 1.6, maxWidth: 520 }}>Real free testnet accounts created by the organizer. Mint and ownership proof are still real transactions; they are clearly badged as demo sessions, never presented as your own wallet.</p>
            <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
              <button className="btn btn-ghost" style={{ justifyContent: 'space-between' }} onClick={() => demo('sntl-peer-02e90eacb8.testnet')} disabled={busy}><span><Sparkles size={14} style={{ verticalAlign: -3, marginRight: 8 }} />Mint to second account <span className="tiny tertiary">(recommended for transfer demo)</span></span><span className="mono tiny tertiary">sntl-peer-02e90eacb8.testnet</span></button>
              <button className="btn btn-ghost" style={{ justifyContent: 'space-between' }} onClick={() => demo('sntl-owner-02e90eacb8.testnet')} disabled={busy}><span><Cpu size={14} style={{ verticalAlign: -3, marginRight: 8 }} />Mint to organizer / Genesis holder</span><span className="mono tiny tertiary">sntl-owner-02e90eacb8.testnet</span></button>
            </div>
          </> : <>
            <div className="card-surface" style={{ padding: 16, borderRadius: 12, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div><div className="card-title">Connected account</div><div className="mono small" style={{ marginTop: 5 }}>{s.accountId}</div></div>
              <div style={{ display: 'flex', gap: 6 }}><Chip tone={s.mode === 'demo' ? 'amber' : 'green'}>{s.mode === 'demo' ? 'DEMO SESSION' : 'WALLET'}</Chip><Chip>{s.scope || 'preview'}</Chip><button className="btn btn-ghost btn-sm" onClick={s.logout}>Change</button></div>
            </div>

            {!mint ? <>
              <div className="card-title" style={{ margin: '24px 0 10px' }}>Step 2 · Mint Sentinel Buddies #{nextId ?? '…'}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 16 }}>
                <div className="card-surface" style={{ padding: 13, borderRadius: 12, border: '1px solid var(--border)' }}><div className="card-title">Mint deposit</div><div className="num" style={{ fontSize: 21, marginTop: 6 }}>{cost?.toFixed?.(5) || '—'} <span className="tiny">NEAR</span></div><div className="tiny tertiary" style={{ marginTop: 4 }}>free testnet tokens</div></div>
                <div className="card-surface" style={{ padding: 13, borderRadius: 12, border: '1px solid var(--border)' }}><div className="card-title">Controller wasm</div><div className="num" style={{ fontSize: 21, marginTop: 6 }}>{quote.data?.breakdown?.controller_wasm_bytes?.toLocaleString() || '—'} <span className="tiny">B</span></div><div className="tiny tertiary" style={{ marginTop: 4 }}>optimized · parent only</div></div>
                <div className="card-surface" style={{ padding: 13, borderRadius: 12, border: '1px solid var(--border)' }}><div className="card-title">Worker allowance</div><div className="num" style={{ fontSize: 21, marginTop: 6 }}>{quote.data?.breakdown?.worker_allowance_near || '—'} <span className="tiny">NEAR</span></div><div className="tiny tertiary" style={{ marginTop: 4 }}>publish_snapshot only</div></div>
              </div>
              <button className="btn btn-primary" onClick={doMint} disabled={busy || cost == null}><Sparkles size={16} /> {busy ? 'Creating agent account…' : `Mint Sentinel Buddies #${nextId ?? '…'}`}</button>
              {birthStep >= 0 && <div style={{ marginTop: 20 }}>
                {BIRTH.map((x, i) => <motion.div key={x.t} initial={{ opacity: .35 }} animate={{ opacity: i <= birthStep ? 1 : .35 }} style={{ display: 'flex', gap: 12, padding: '9px 0', position: 'relative' }}>
                  {i < BIRTH.length - 1 && <span className="step-line" style={{ left: 11, top: 26, bottom: 0 }} />}
                  <span style={{ flex: '0 0 24px', height: 24, borderRadius: 7, display: 'grid', placeItems: 'center', background: i < birthStep ? 'rgba(0,236,151,.12)' : 'var(--surface-2)', border: `1px solid ${i < birthStep ? 'rgba(0,236,151,.4)' : 'var(--border)'}` }}>{i < birthStep ? <Check size={13} color="var(--green)" /> : <span className="mono tiny tertiary">{i + 1}</span>}</span>
                  <div><div className="small" style={{ fontWeight: 550 }}>{x.t}</div><div className="tiny tertiary" style={{ marginTop: 3 }}>{x.d}</div>{i === birthStep && busy && <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: .85 }} style={{ height: 2, background: 'var(--green)', marginTop: 8 }} />}</div>
                </motion.div>)}
              </div>}
            </> : <>
              <div className="card-title" style={{ margin: '24px 0 10px' }}>Step 3 · Prove ownership, unlock the vault</div>
              <div className="card-surface" style={{ padding: 16, borderRadius: 12, border: '1px solid rgba(0,236,151,.25)', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}><Chip tone="green"><Check size={11} /> REAL MINT TX</Chip><span className="mono tiny">{shortHash(mint.tx, 16)}</span>{mint.explorer_url && <a href={mint.explorer_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm"><ExternalLink size={12} /> Explorer</a>}</div>
                <div className="kv" style={{ marginTop: 12 }}><span className="kv-k">Token</span><span className="kv-v">#{mint.token_id}</span></div>
                <div className="kv"><span className="kv-k">Owner</span><span className="kv-v">{mint.owner}</span></div>
                <div className="kv"><span className="kv-k">Agent account</span><span className="kv-v" style={{ color: 'var(--cyan)' }}>{mint.agent_account || 'provisioning…'}</span></div>
                <div className="tiny tertiary" style={{ marginTop: 10, lineHeight: 1.6 }}>{mint.note}</div>
              </div>
              {!unlocked ? <>
                <button className="btn btn-primary" onClick={doProve} disabled={stage === 'signing' || stage === 'checking' || stage === 'challenge'}><ShieldCheck size={16} /> {(stage === 'signing' || stage === 'checking' || stage === 'challenge') ? <><RefreshCw size={15} className="animate-spin" /> Proving ownership…</> : 'Prove ownership & unlock vault'}</button>
                <p className="small muted" style={{ lineHeight: 1.6, marginTop: 12 }}>{s.mode === 'demo' ? 'Demo path: a real attest_holder transaction signed by the testnet account, verified from the receipt log. No wallet needed.' : 'Wallet path: NEP-413 off-chain signMessage with a full-access key, verified against view_access_key and on-chain is_holder. No gas.'}</p>
                {result.tx && <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}><Chip tone="green">REAL PROOF TX</Chip><span className="mono tiny">{shortHash(result.tx, 14)}</span><a href={result.explorer_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm"><ExternalLink size={12} /> Explorer</a></div>}
              </> : <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}><AgentArt tokenId={mint.token_id} size={100} /><div><h3 className="h3">Vault unlocked.</h3><p className="small muted" style={{ marginTop: 6, maxWidth: 330, lineHeight: 1.6 }}>Ownership proven via {result.method || 'on-chain proof'}. A 10-minute holder session is now active, with on-chain status re-checked on every request.</p></div></div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 18 }}><Link href="/vault" className="btn btn-primary">Open full-resolution vault <ArrowRight size={15} /></Link><Link href={`/agent/${mint.token_id}`} className="btn btn-ghost">Inspect agent <Cpu size={14} /></Link></div>
              </motion.div>}
            </>}
          </>}
          {error && <div className="chip chip-rose" style={{ height: 'auto', padding: 10, marginTop: 16, whiteSpace: 'normal', lineHeight: 1.5 }} role="alert"><AlertTriangle size={13} /> {error}</div>}
        </Card>

        <motion.div className="col-5" initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .7 }}>
          <Card style={{ padding: 28, height: '100%', minHeight: 430, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <span className="eyebrow">The anatomy of a mint</span>
              <h3 className="h3" style={{ marginTop: 12 }}>Not a JPEG. An account with a job.</h3>
              <p className="small muted" style={{ lineHeight: 1.65, marginTop: 10 }}>The NFT contract itself creates the subaccount with a promise batch, so no organizer key is required on the wallet path. The only key on the agent is a function-call key restricted to one method on one receiver.</p>
            </div>
            <div style={{ display: 'grid', placeItems: 'center', padding: '20px 0' }}>
              <AnimatePresence mode="wait">
                <motion.div key={unlocked ? 'awake' : mint ? 'born' : 'dormant'} initial={{ scale: .85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.1, opacity: 0 }} transition={{ duration: .7 }}>
                  <div style={{ position: 'relative' }}><AgentArt tokenId={mint?.token_id || '0'} size={210} />
                    {unlocked && <motion.div initial={{ scale: .5, opacity: 0 }} animate={{ scale: 1.35, opacity: 0 }} transition={{ duration: 1.6, repeat: Infinity }} style={{ position: 'absolute', inset: -10, borderRadius: '50%', border: '1px solid var(--green)' }} />}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}><Badge kind="fact">1 restricted key</Badge><Badge kind="fact">Parent = NFT contract</Badge><Badge kind="fact">No FullAccess</Badge></div>
            <div className="tiny tertiary" style={{ textAlign: 'center', marginTop: 12, lineHeight: 1.6 }}>Selected Sentinel character is shared website artwork, not a unique token image or a live fuel indicator. Deployed NFT media and the original gateway SVG remain unchanged.</div>
          </Card>
        </motion.div>

        {unlocked && <><TransferDemo /><Card className="col-12" title="Judge flow · what just happened">
          <div className="bento" style={{ gap: 12 }}>
            {[
              { icon: <Wallet size={16} />, t: 'Identity', d: `${s.accountId} ${s.mode === 'demo' ? '(demo preview session)' : '(wallet)'}` },
              { icon: <KeyRound size={16} />, t: 'Agent birth', d: `token #${mint?.token_id} · ${mint?.agent_account || 'provisioning'}` },
              { icon: <ShieldCheck size={16} />, t: 'Ownership proof', d: result.method || 'on-chain attestation' },
              { icon: <Unlock size={16} />, t: 'Access', d: '10-min JWT, on-chain holder re-check' },
              { icon: <ArrowLeftRight size={16} />, t: 'Transfer', d: 'first loses access · second gains it · history persists' },
            ].map((x, i) => <div key={x.t} className="col-4" style={{ gridColumn: i > 2 ? 'span 6' : undefined }}><div className="card-surface" style={{ padding: 14, borderRadius: 12, border: '1px solid var(--border)' }}><span style={{ color: 'var(--green)' }}>{x.icon}</span><div className="small" style={{ fontWeight: 600, marginTop: 9 }}>{x.t}</div><div className="tiny tertiary mono" style={{ marginTop: 5, wordBreak: 'break-all' }}>{x.d}</div></div></div>)}
          </div>
        </Card></>}
      </div>
    </div>
  );
}
