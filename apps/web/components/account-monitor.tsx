'use client';
import React, {useState} from 'react';
import {useSentinel} from '../app/providers';
import {useJson} from '../lib/api';
import {AiExplanation} from './ai-explanation';

export function AccountMonitor(){
 const s=useSentinel();
 const feed=useJson<any>(s.scope==='holder'?'/api/watchlist':null,{auth:true,intervalMs:60000});
 const [account,setAccount]=useState('');const [network,setNetwork]=useState('mainnet');const [threshold,setThreshold]=useState('1');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function save(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{await s.api('/api/watchlist',{method:'POST',body:JSON.stringify({account:account.trim(),network,threshold_near:threshold})});await feed.refresh();setAccount('');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 async function remove(id:string){setBusy(true);setError('');try{await s.api('/api/watchlist/remove',{method:'POST',body:JSON.stringify({id})});await feed.refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const when=(v:number)=>new Date(v).toLocaleString();
 return <section id="monitored-accounts" aria-labelledby="monitor-title" className="wrap section" style={{scrollMarginTop:90}}>
  <span className="eyebrow">HOLDER TOOLS · READ-ONLY MONITORING</span>
  <h2 id="monitor-title" className="h2" style={{marginTop:12}}>My monitored <span style={{color:'var(--green)'}}>accounts.</span></h2>
  <p className="lead">Watch up to three NEAR accounts. Inspect recorded balances, exact block references and changes between observations. No trades. No fund transfers. No invented explanations.</p>
  {s.scope==='holder'&&<>
   <AiExplanation/>
   <section className="card" style={{padding:24,marginBottom:20}}>
    <p><strong>{feed.data?.collector_enabled?'Scheduled collector enabled':'Scheduled collector is off or status unavailable'}</strong></p>
    <p className="muted">Observations target a 15-minute interval; queueing, RPC failures and free-tier limits may delay them. These new observations are <strong>not yet committed on-chain</strong>. Dashboard alerts only—no email or push notifications.</p>
    <form onSubmit={save} style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'end'}}>
     <label>Network<select className="input" value={network} onChange={e=>setNetwork(e.target.value)}><option value="mainnet">Mainnet</option><option value="testnet">Testnet</option></select></label>
     <label style={{flex:'1 1 240px'}}>Account ID<input className="input" value={account} onChange={e=>setAccount(e.target.value)} placeholder={network==='mainnet'?'example.near':'example.testnet'} required maxLength={64}/></label>
     <label>Warn below (NEAR)<input className="input" value={threshold} onChange={e=>setThreshold(e.target.value)} inputMode="decimal" required style={{maxWidth:180}}/></label>
     <button className="btn btn-primary" disabled={busy}>{busy?'Saving…':'Save watch'}</button>
    </form><p className="tiny tertiary">Saving an existing account updates its threshold. Prototype capacity: 3 watches per holder, 30 total. Monitoring begins only after the collector is enabled.</p>
   </section>
   {feed.loading&&!feed.data&&<p>Loading watchlist…</p>}
   {feed.data?.items?.length===0&&<p>No watches yet. Add an account above.</p>}
   {(feed.data?.items||[]).map((w:any)=><section className="card" key={w.id} style={{padding:24,marginBottom:18}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}><div><span className="eyebrow">{w.network} · {w.status}</span><h2 style={{overflowWrap:'anywhere'}}>{w.account}</h2></div><button className="btn btn-ghost" disabled={busy} onClick={()=>remove(w.id)}>Remove</button></div>
    {w.last_error&&<p role="alert" style={{color:'#ff8596'}}>{w.last_error} Previous data below is retained, not a new successful observation.</p>}
    {w.latest?<><div style={{display:'flex',gap:24,flexWrap:'wrap'}}><div><span className="tiny tertiary">ACCOUNT AMOUNT · NEAR</span><p className="mono" style={{overflowWrap:'anywhere'}}>{w.amount_near}</p></div><div><span className="tiny tertiary">CHANGE BETWEEN OBSERVATIONS</span><p className="mono" style={{overflowWrap:'anywhere'}}>{w.net_balance_change_near??'Need a second observation'}</p></div><div><span className="tiny tertiary">EXACT BLOCK-TIME INTERVAL</span><p>{w.comparison_seconds===null?'Not available':`${w.comparison_seconds} seconds`}</p></div></div>
     <p style={{color:w.low_balance?'#ffcf70':'var(--text-2)'}}>{w.low_balance===null?'Warning status unavailable: observation is stale or collection failed.':w.low_balance?`LOW BALANCE: below your ${w.threshold_near} NEAR threshold.`:`Amount is at or above your ${w.threshold_near} NEAR threshold.`}</p>
     <p className="tiny tertiary">Observed {when(w.latest.observed_at)} · Block {w.latest.block_height} · Block time {when(Number(BigInt(w.latest.block_timestamp_ns)/1000000n))}</p>
     <p className="mono tiny" style={{overflowWrap:'anywhere'}}>Block hash: {w.latest.block_hash}</p>
     <p className="tiny tertiary">Source: {w.latest.source} · Locked: {w.locked_near} NEAR · Storage: {w.latest.storage_usage} bytes</p>
     <details><summary style={{cursor:'pointer'}}>Recent observations ({w.history.length}, up to 20 shown)</summary><div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left',fontSize:12}}><thead><tr><th>Observed</th><th>Block</th><th>Account amount (NEAR)</th></tr></thead><tbody>{w.history.map((r:any)=><tr key={r.block_hash}><td>{when(r.observed_at)}</td><td>{r.block_height}</td><td>{(Number(r.amount)/1e24).toLocaleString(undefined,{maximumFractionDigits:6})} (rounded)</td></tr>)}</tbody></table></div></details>
    </>:<p>Awaiting the first successful scheduled observation. No balance or change has been fabricated.</p>}
    <p className="tiny tertiary" style={{marginTop:16}}>{w.note}</p><a className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer" href={`https://${w.network==='testnet'?'testnet.':''}nearblocks.io/address/${encodeURIComponent(w.account)}`}>Inspect public account ↗</a>
   </section>)}
  </>}
  {(error||feed.error)&&<p role="alert" style={{color:'#ff8596'}}>{error||feed.error}</p>}
 </section>;
}
