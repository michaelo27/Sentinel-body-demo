'use client';
import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { KeyRound, Fuel, Activity, ExternalLink, ShieldCheck, Cpu, ArrowLeftRight, RefreshCw, Check, X } from 'lucide-react';
import { AgentArt } from '@/components/agent-art';
import { TransferDemo } from '@/components/transfer-demo';
import { Card, Chip, HashRow, shortHash, TimeAgo, absoluteTime, Skeleton, EmptyState, Badge } from '@/components/ui';
import { useJson, explorerTx, explorerAccount } from '@/lib/api';

export default function AgentPage() {
  const params = useParams<{ id: string }>();
  const id = String(params?.id || '0');
  const a = useJson<any>(`/api/agent/${id}`, { auth: false, intervalMs: 30000 });
  const d = a.data;
  const balance = d?.balance_near ?? null;
  const fuelPct = balance == null ? 0 : Math.min(100, Math.max(0, balance / 1.56312 * 100));
  const lowFuel = balance != null && balance < 0.4;

  return (
    <div className="wrap" style={{ paddingTop: 48, paddingBottom: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 26 }}>
        <div><span className="eyebrow">Agent console · token #{id}</span><h1 className="h2" style={{ marginTop: 10 }}>A body with <span className="serif" style={{ color: 'var(--green)' }}>one key.</span></h1><p className="lead" style={{ maxWidth: 640, marginTop: 12 }}>This account was created by the NFT contract at mint. It has no full-access key; all authority flows from the parent contract and therefore from the current NFT holder.</p></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><Link href="/vault" className="btn btn-ghost btn-sm">Holder vault</Link><Link href="/proof" className="btn btn-primary btn-sm"><ShieldCheck size={13} /> Proof</Link></div>
      </div>

      {a.loading && !d ? <div className="bento"><Card className="col-12"><div style={{ display: 'grid', gap: 12 }}><Skeleton h={40} /><Skeleton h={80} /><Skeleton h={60} /></div></Card></div> : a.error || d?.error ? <Card><EmptyState title="Agent not found" body={a.error || d?.error} action={<Link href="/mint" className="btn btn-primary">Mint a Sentinel Body</Link>} /></Card> : (
        <div className="bento" style={{ rowGap: 16 }}>
          <Card className="col-4" style={{ padding: 26, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <AgentArt tokenId={id} size={210} />
            <h2 className="h3" style={{ marginTop: 20 }}>Sentinel Body #{id}</h2>
            <div className="mono tiny" style={{ color: 'var(--cyan)', marginTop: 6, wordBreak: 'break-all' }}>{d.agent_account}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginTop: 14 }}>
              <Chip tone="green"><span className="dot dot-live" />{d.commitments?.length || 0} PUBLISHES</Chip>
              {d.no_full_access_key ? <Chip tone="green"><Check size={11} /> NO FULL ACCESS</Chip> : <Chip tone="rose"><X size={11} /> FULL ACCESS PRESENT</Chip>}
            </div>
            <a href={d.explorer_url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{ marginTop: 18 }}><ExternalLink size={13} /> Account explorer</a>
          </Card>

          <Card className="col-8" title="On-chain state · live RPC views" right={<button className="btn btn-ghost btn-sm" onClick={a.refresh} aria-label="Refresh agent state"><RefreshCw size={13} /></button>}>
            <div className="bento" style={{ gap: 12 }}>
              <div className="col-6"><div className="card-surface" style={{ padding: 15, borderRadius: 12, border: '1px solid var(--border)' }}>
                <div className="card-title"><Cpu size={12} style={{ verticalAlign: -2 }} /> Current owner</div><div className="mono small" style={{ marginTop: 8, color: 'var(--green)', wordBreak: 'break-all' }}>{d.owner_id}</div>
                <div className="tiny tertiary" style={{ marginTop: 6 }}>nft_token view · transfer changes this</div>
              </div></div>
              <div className="col-6"><div className="card-surface" style={{ padding: 15, borderRadius: 12, border: '1px solid var(--border)' }}>
                <div className="card-title"><Fuel size={12} style={{ verticalAlign: -2 }} /> Fuel balance</div><div className="num" style={{ fontSize: 24, marginTop: 6, color: lowFuel ? 'var(--amber)' : 'var(--text)' }}>{balance?.toFixed(5)} <span className="tiny tertiary">NEAR</span></div>
                <div style={{ height: 6, background: 'rgba(255,255,255,.06)', borderRadius: 4, marginTop: 8 }}><motion.div initial={{ width: 0 }} animate={{ width: `${fuelPct}%` }} style={{ height: '100%', background: lowFuel ? 'var(--amber)' : 'linear-gradient(90deg,var(--green),var(--cyan))', borderRadius: 4 }} /></div>
                <div className="tiny tertiary" style={{ marginTop: 6 }}>{d.storage_usage_bytes?.toLocaleString()} bytes storage · {lowFuel ? 'LOW FUEL' : 'healthy'} · seed 1.56312 NEAR</div>
              </div></div>
              <div className="col-12" style={{ marginTop: 4 }}>
                <div className="card-title" style={{ marginBottom: 10 }}>Access keys · view_access_key_list</div>
                {(d.access_keys || []).length ? d.access_keys.map((k: any, i: number) => {
                  const fc = k.access_key.permission?.FunctionCall;
                  const full = k.access_key.permission === 'FullAccess';
                  return <div key={i} className="card-surface" style={{ padding: 15, borderRadius: 12, border: `1px solid ${full ? 'rgba(255,92,122,.4)' : 'rgba(0,236,151,.3)'}`, marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}><span className="mono tiny" style={{ color: full ? 'var(--rose)' : 'var(--green)' }}>{k.public_key}</span><span className={`chip ${full ? 'chip-rose' : 'chip-green'}`}>{full ? 'FULL ACCESS (UNEXPECTED)' : 'FUNCTION-CALL ONLY'}</span></div>
                    {fc && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 12 }}>
                      <div><div className="tiny tertiary">Receiver</div><div className="mono tiny">{fc.receiver_id}</div></div>
                      <div><div className="tiny tertiary">Methods</div><div className="mono tiny" style={{ color: 'var(--green)' }}>{(fc.method_names || []).join(', ') || '(any)'}</div></div>
                      <div><div className="tiny tertiary">Remaining allowance</div><div className="mono tiny">{(Number(fc.allowance || 0) / 1e24).toFixed(5)} NEAR</div></div>
                      <div><div className="tiny tertiary">Nonce</div><div className="mono tiny">{k.access_key.nonce}</div></div>
                    </div>}
                  </div>;
                }) : <p className="small muted">No access keys returned by the RPC.</p>}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}><Badge kind="fact">No FullAccess key</Badge><Badge kind="fact">publish_snapshot only</Badge><Badge kind="fact">Controller parent = NFT contract</Badge></div>
              </div>
            </div>
          </Card>

          <TransferDemo />

          <Card className="col-7" title="Commitments signed by this agent" right={<Chip>{d.commitments?.length || 0} records</Chip>}>
            <div style={{ overflowX: 'auto' }}><table className="table"><thead><tr><th>Snapshot</th><th>Hash</th><th>Block</th><th>When</th></tr></thead><tbody>
              {(d.commitments || []).slice().reverse().map((c: any) => <tr key={c.id}><td style={{ color: 'var(--cyan)' }}>{shortHash(c.id, 16)}</td><td>{shortHash(c.content_hash, 12)}</td><td>{c.block_height?.toLocaleString()}</td><td><TimeAgo iso={Number(c.block_timestamp) / 1e6} /></td></tr>)}
            </tbody></table></div>
            {!d.commitments?.length && <EmptyState title="No publishes yet" body="The agent publishes its first snapshot on the next round." />}
            <p className="tiny tertiary" style={{ marginTop: 12, marginBottom: 0 }}>History stays with the agent account after an NFT transfer. The new owner sees every prior commitment.</p>
          </Card>

          <Card className="col-5" title="Activity · gateway event log">
            <div className="terminal" style={{ maxHeight: 310, overflow: 'auto' }}>
              {(d.activity || []).map((x: any, i: number) => <div className="terminal-row" key={i}>
                <span className="terminal-time">{new Date(x.at).toISOString().slice(11, 19)}</span>
                <span className="terminal-step">{x.step}</span>
                <span style={{ color: x.ok ? 'var(--text-2)' : 'var(--rose)', wordBreak: 'break-word' }}>{x.detail}</span>
              </div>)}
            </div>
            <div className="tiny tertiary" style={{ marginTop: 12, lineHeight: 1.6 }}>Runtime loop: 30 min · <span className="mono">/admin/run-now</span> for a one-off round · multiple agent accounts publish round-robin. A failed free source falls back to the last real snapshot with a visible STALE badge.</div>
          </Card>

          <Card className="col-12" title="Controller contract surface · parent only">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['parent()', 'worker_key()', 'withdraw(amount)', 'set_worker_key(public_key)', 'publish_snapshot(…)', 'agent_withdraw(…)', 'agent_set_worker_key(…)'].map((m) => <Chip key={m}>{m}</Chip>)}
            </div>
            <p className="small muted" style={{ lineHeight: 1.65, marginTop: 14, marginBottom: 0 }}>The controller enforces <span className="mono tiny">parent == NFT contract</span> on every privileged method. The NFT contract itself gates agent control with a 1-yocto owner check. Scoped function-call keys derived from ownership are deliberately a non-goal for this MVP; see the threat model.</p>
          </Card>
        </div>
      )}
    </div>
  );
}
