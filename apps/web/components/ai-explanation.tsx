'use client';
import {useState} from 'react';
import {useSentinel} from '@/app/providers';
import {useJson} from '@/lib/api';
import {AgentReport} from './agent-report';
export function AiExplanation(){
 const s=useSentinel();const watches=useJson<any>(s.scope==='holder'?'/api/watchlist':null,{auth:true,intervalMs:60000});
 const history=useJson<any>(s.scope==='holder'?'/api/ai/history':null,{auth:true});
 const [selected,setSelected]=useState(''),[consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[report,setReport]=useState<any>(null);
 if(s.scope!=='holder')return null;
 const items=watches.data?.items||[];const watch=items.find((w:any)=>w.id===selected);
 async function explain(){setBusy(true);setError('');setReport(null);try{const r=await s.api<any>('/api/ai/explain',{method:'POST',body:JSON.stringify({watch_id:selected,consent})});setReport(r);}catch(e){setError((e as Error).message);}finally{setBusy(false);await history.refresh();}}
 return <section className="card" style={{padding:24,margin:'24px 0'}} aria-labelledby="ai-title">
  <span className="eyebrow">NEAR AI CLOUD · HOLDER-REQUESTED ANALYSIS</span><h3 id="ai-title">Explain my saved observations</h3>
  <p className="muted">Facts and arithmetic come from saved RPC evidence and code. The model supplies a separate interpretation—not verified causes, trading advice or autonomous agent execution.</p>
  <p className="small muted">{history.data?.enabled?'AI enabled':'AI disabled or status unavailable'} · Up to 3 attempts/day per holder, 10/day globally, 40 total for this demo. Failed attempts count. Unchanged successful reports are reused.</p>
  <label>Saved watch <select className="input" value={selected} disabled={busy} onChange={e=>{setSelected(e.target.value);setReport(null);setConsent(false);}}><option value="">Choose a monitored account</option>{items.map((w:any)=><option key={w.id} value={w.id}>{w.account} · {w.network}</option>)}</select></label>
  {watch&&<p className="small muted">Saved evidence status: {watch.status}. {watch.stale?'This is stale historical data, not a current balance report.':''} {!watch.previous?'Only one or no observation: a change cannot be established.':''}</p>}
  <label style={{display:'flex',gap:10,margin:'16px 0'}}><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/><span>I agree to send up to two saved balance observations, network and block references to NEAR AI Cloud. Wallet signatures, keys and my holder identity are not sent. Public block details may still identify activity. The report is stored privately in D1.</span></label>
  <button className="btn btn-primary" disabled={busy||!consent||!watch?.latest||!history.data?.enabled||!!history.error} onClick={explain}>{busy?'Requesting AI explanation…':'Explain saved evidence'}</button>
  <button className="btn btn-ghost" disabled={busy} onClick={()=>{history.refresh();watches.refresh();}}>Refresh status</button>
  {(error||history.error||watches.error)&&<p role="alert">{error||history.error||watches.error}</p>}
  {report&&<article style={{marginTop:24}}>
   <h4>Recorded facts — not model-generated</h4>
   <p className="small muted">Report {report.id} · Generated {new Date(report.created).toLocaleString()} · {report.cached?'Cached result':'New result'}</p>
   {report.evidence.sources.map((r:any)=><div key={r.id} style={{padding:'12px 0',overflowWrap:'anywhere'}}><strong>{r.id}: block {r.block_height}</strong><p>Amount: {r.amount_near} NEAR · Locked: {r.locked_near} NEAR · Storage: {r.storage_usage_bytes} bytes</p><p className="small muted">Observed {new Date(r.observed_at).toLocaleString()} · Block time {new Date(Number(BigInt(r.block_timestamp_ns)/1000000n)).toLocaleString()}<br/>{r.block_hash}<br/>Source: {r.rpc}</p></div>)}
   <h4>Calculated results — computed by code</h4><p>Net amount change: {report.evidence.calculated.net_change_near===null?'Unavailable: need two observations':`${report.evidence.calculated.net_change_near} NEAR`}</p><p className="small muted">Exact elapsed nanoseconds: {report.evidence.calculated.elapsed_nanoseconds??'Unavailable'}</p>
   {report.result&&<><h4>AI interpretation — unverified</h4><p>{report.result.analysis.interpretation} [{report.result.analysis.source_ids.join(', ')}]</p><h4>Possible explanations — hypotheses only</h4>{report.result.analysis.possible_explanations.length?report.result.analysis.possible_explanations.map((p:any,i:number)=><p key={i}>{p.text} [{p.source_ids.join(', ')}]</p>):<p>No possible cause proposed from this evidence.</p>}<h4>What remains unknown</h4><ul>{report.result.analysis.limitations.map((v:string,i:number)=><li key={i}>{v}</li>)}</ul><p className="small muted">{report.result.warning}</p><p className="tiny tertiary">Model: {report.model} · Provider-reported tokens: {report.result.usage?.total_tokens??'unavailable'} · Response ID: {report.result.provider_response_id??'unavailable'}</p></>}
   {report.status==='complete'&&<AgentReport key={report.id} reportId={report.id}/>}
   <p className="small muted">{report.evidence.scope} Model attestation is not independently verified in this build. Executor: {report.executor}.</p>
  </article>}
  <details style={{marginTop:20}}><summary>AI execution history (latest 10)</summary><p className="small muted">Pending means completion is unconfirmed, not success. Failed or interrupted calls may have incurred provider charges. Removing a watch hides its reports but retains quota/audit records.</p>{(history.data?.items||[]).map((r:any)=><div key={r.id} style={{padding:'10px 0'}}><span>{new Date(r.created).toLocaleString()} · {r.status} · {r.model}</span>{r.status==='complete'&&<button className="btn btn-ghost btn-sm" onClick={()=>setReport(r)}>View saved report</button>}{r.error&&<p role="status">{r.error}</p>}</div>)}</details>
 </section>;
}
