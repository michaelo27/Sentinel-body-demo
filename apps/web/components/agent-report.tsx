'use client';
import {useState} from 'react';
import {useSentinel} from '@/app/providers';
import {useJson} from '@/lib/api';
function download(p:any){const url=URL.createObjectURL(new Blob([JSON.stringify(p,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`${p.payload.snapshot_id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function AgentReport({reportId}:{reportId:string}){
 const s=useSentinel();const [token,setToken]=useState(''),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const h=useJson<any>(s.scope==='holder'?'/api/agent-reports/history':null,{auth:true});
 async function prepare(){setBusy(true);setError('');try{const p=await s.api<any>('/api/agent-reports/prepare',{method:'POST',body:JSON.stringify({report_id:reportId,token_id:token,consent})});download(p);await h.refresh();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section style={{padding:20,marginTop:24,border:'1px solid var(--border)',borderRadius:16}}>
  <span className="eyebrow">NFT AGENT ROLE · MONITORING-REPORT PUBLISHER</span><h4>Prepare this report for my NFT’s agent</h4>
  <p className="small muted">The Worker collected the observations; NEAR AI generated the interpretation. Your NFT’s agent can publish the report hash through its restricted signing key. Publication is operator-triggered, not autonomous. Preparing a packet sends no transaction.</p>
  <label>Your NFT token ID<input className="input" value={token} onChange={e=>setToken(e.target.value)} inputMode="numeric" placeholder="For example, 1" maxLength={4} disabled={busy}/></label>
  <label style={{display:'flex',gap:8,margin:'12px 0'}}><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} disabled={busy}/><span>I understand publication makes the hash and agent/token linkage public. The downloaded report contains private evidence; I will not commit it to Git or share it unintentionally.</span></label>
  <button className="btn btn-primary" disabled={busy||!consent||!/^(0|[1-9]\d{0,3})$/.test(token)} onClick={prepare}>{busy?'Preparing…':'Prepare & download report packet'}</button>
  {(error||h.error)&&<p role="alert">{error||h.error}</p>}
  <h4>Agent report execution history</h4><button className="btn btn-ghost" disabled={busy} onClick={h.refresh}>Check on-chain publication</button>
  <p className="small muted">{h.data?.note}</p>
  {(h.data?.items||[]).map((r:any)=><article key={r.id} style={{padding:'12px 0',overflowWrap:'anywhere'}}><strong>NFT #{r.token_id} · {r.verification==='verified-on-chain'?'PUBLISHED · ON-CHAIN MATCH':r.verification==='rpc-unavailable'?'VERIFICATION UNAVAILABLE':r.verification==='commitment-mismatch'?'WARNING: COMMITMENT MISMATCH':'PREPARED · NO RETAINED COMMITMENT FOUND'}</strong><p className="small mono">Publisher: {r.agent_account}</p><p className="small muted">Role: monitoring-report publisher · AI report {r.report_id}<br/>Prepared {new Date(r.created).toLocaleString()}</p><p className="tiny mono">SHA-256: {r.content_hash}</p>{r.commitment&&<p className="small muted">Commitment block: {r.commitment.block_height}</p>}<button className="btn btn-ghost btn-sm" onClick={()=>download({payload:r.payload,content_hash:r.content_hash})}>Download packet</button></article>)}
  <p className="tiny tertiary">A matching commitment verifies report bytes and the publishing account—not AI accuracy. Contract history is bounded and can prune older commitments. Local publisher execution is separate from the Cloudflare collector and model service.</p>
 </section>;
}
