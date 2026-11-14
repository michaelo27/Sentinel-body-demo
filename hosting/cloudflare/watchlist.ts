/** Bounded, read-only collector. No signing keys, LLM calls or chain publications. */
import { HttpError, holder } from './platform';
const INTERVAL=15*60_000, STALE=30*60_000;
const SOURCES={mainnet:'https://free.rpc.fastnear.com',testnet:'https://test.rpc.fastnear.com'};
export function nearToYocto(v:unknown):string {
 const s=String(v??'').trim();if(!/^(0|[1-9]\d{0,8})(\.\d{1,24})?$/.test(s))throw new HttpError(400,'Threshold must be a non-negative NEAR amount (up to 24 decimal places).');
 const [a,b='']=s.split('.');return (BigInt(a)*10n**24n+BigInt(b.padEnd(24,'0'))).toString();
}
export function formatNear(v:string):string {
 let n=BigInt(v),sign=n<0n?'-':'';if(n<0n)n=-n;
 const frac=(n%10n**24n).toString().padStart(24,'0').replace(/0+$/,'');return sign+(n/10n**24n).toString()+(frac?'.'+frac:'');
}
function accountValid(v:unknown):v is string{return typeof v==='string' && v.length>=2 && v.length<=64 && /^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/.test(v);}
async function call(network:keyof typeof SOURCES,method:string,params:any){
 const r=await fetch(SOURCES[network],{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'sentinel-monitor',method,params}),signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error('RPC unavailable; no observation recorded.');const j:any=await r.json();
 if(j.error||!j.result)throw Error('Account or block unavailable from RPC; no observation recorded.');return j.result;
}
export async function observe(network:keyof typeof SOURCES,account:string){
 const state=await call(network,'query',{request_type:'view_account',finality:'final',account_id:account});
 if(!/^\d+$/.test(state.amount)||!/^\d+$/.test(state.locked)||!Number.isSafeInteger(state.block_height)||typeof state.block_hash!=='string'||!Number.isSafeInteger(state.storage_usage))throw Error('Invalid RPC account response; no observation recorded.');
 // Pin the timestamp lookup to precisely the block returned by view_account.
 const block=await call(network,'block',{block_id:state.block_hash});const h=block.header;
 if(h?.hash!==state.block_hash||h?.height!==state.block_height||!/^\d+$/.test(h.timestamp_nanosec))throw Error('Block provenance mismatch; no observation recorded.');
 return {observed_at:Date.now(),block_height:state.block_height,block_hash:state.block_hash,block_timestamp_ns:h.timestamp_nanosec,amount:state.amount,locked:state.locked,storage_usage:state.storage_usage,source:SOURCES[network]};
}
export function describe(w:any,rows:any[],now=Date.now()){
 const latest=rows[0]||null,previous=rows[1]||null;
 const stale=!latest || now-latest.observed_at>STALE || now-Number(BigInt(latest.block_timestamp_ns)/1000000n)>STALE;
 const delta=latest&&previous?BigInt(latest.amount)-BigInt(previous.amount):null;
 const seconds=latest&&previous?(BigInt(latest.block_timestamp_ns)-BigInt(previous.block_timestamp_ns))/1000000000n:null;
 return {id:w.id,network:w.network,account:w.account,threshold_near:formatNear(w.threshold_yocto),next_due:w.next_due,last_error:w.last_error,
 status:!latest?'awaiting-observation':w.last_error?'collection-error':stale?'stale':'observed',
 stale,latest,previous,
 amount_near:latest?formatNear(latest.amount):null,locked_near:latest?formatNear(latest.locked):null,
 net_balance_change_near:delta===null?null:formatNear(delta.toString()),comparison_seconds:seconds===null?null:seconds.toString(),
 low_balance:latest&&!stale&&!w.last_error?BigInt(latest.amount)<BigInt(w.threshold_yocto):null,
 history:rows,commitment_status:'not-committed',
 note:'RPC-observed account amount, not guaranteed spendable balance. Storage requirements and locked balance are separate. Change is NOT transfer volume, does not identify a destination, and does not explain its cause. These observations are not yet committed on-chain.'};
}
export async function watchApi(path:string,method:string,body:any,owner:string,env:any){
 if(path==='/api/watchlist'&&method==='GET'){
  const {results}=await env.DB.prepare('SELECT * FROM watches WHERE owner=? ORDER BY created').bind(owner).all();
  const items=[];for(const w of results){const {results:rows}=await env.DB.prepare('SELECT * FROM observations WHERE watch_id=? ORDER BY block_height DESC LIMIT 20').bind(w.id).all();items.push(describe(w,rows));}
  return {items,limits:{per_holder:3,global:30},collector_enabled:env.MONITOR_ENABLED==='1',interval_minutes:15,mode:'rpc-monitoring',on_chain_publication:false,privacy:'Watchlist configuration is private to this holder account; target blockchain accounts are public.',delivery:'Dashboard warnings only; no email, push notifications, trades or transfers.'};
 }
 if(path==='/api/watchlist'&&method==='POST'){
  if(!accountValid(body.account)||!Object.hasOwn(SOURCES,body.network))throw new HttpError(400,'Choose mainnet or testnet and enter a valid NEAR account ID.');
  const threshold=nearToYocto(body.threshold_near);
  const existing=await env.DB.prepare('SELECT id FROM watches WHERE owner=? AND network=? AND account=?').bind(owner,body.network,body.account).first();
  if(existing){await env.DB.prepare('UPDATE watches SET threshold_yocto=? WHERE id=? AND owner=?').bind(threshold,existing.id,owner).run();return {ok:true,id:existing.id,updated:true};}
  const id=crypto.randomUUID();
  const row=await env.DB.prepare('INSERT INTO watches(id,owner,network,account,threshold_yocto,created,next_due) SELECT ?,?,?,?,?,?,0 WHERE (SELECT COUNT(*) FROM watches WHERE owner=?)<3 AND (SELECT COUNT(*) FROM watches)<30 ON CONFLICT(owner,network,account) DO NOTHING RETURNING id').bind(id,owner,body.network,body.account,threshold,Date.now(),owner).first();
  if(!row)throw new HttpError(409,'Watchlist is full or this account was just added. Refresh. Free prototype limit: 3 per holder, 30 total.');return {ok:true,id:row.id};
 }
 if(path==='/api/watchlist/remove'&&method==='POST'){
  const w=await env.DB.prepare('SELECT id FROM watches WHERE id=? AND owner=?').bind(String(body.id||''),owner).first();
  if(!w)throw new HttpError(404,'Watch not found.');
  await env.DB.batch([env.DB.prepare('DELETE FROM observations WHERE watch_id=?').bind(w.id),env.DB.prepare('DELETE FROM watches WHERE id=? AND owner=?').bind(w.id,owner)]);return {ok:true};
 }
 throw new HttpError(405,'Unsupported watchlist operation.');
}
export async function runScheduled(env:any){
 if(env.MONITOR_ENABLED!=='1')return {skipped:'disabled'};
 const now=Date.now(),token=crypto.randomUUID();
 const lock=await env.DB.prepare("INSERT INTO monitor_lock(id,lease_until,token) VALUES('collector',?,?) ON CONFLICT(id) DO UPDATE SET lease_until=excluded.lease_until,token=excluded.token WHERE monitor_lock.lease_until<? RETURNING token").bind(now+180000,token,now).first();
 if(!lock)return {skipped:'another-round-running'};
 let observed=0,failed=0;
 try{
  // At most 3 targets/tick, 9 external RPC calls including holder checks.
  const {results}=await env.DB.prepare('SELECT * FROM watches WHERE next_due<=? ORDER BY next_due,created LIMIT 3').bind(now).all();
  for(const w of results){
   try{
    if(!await holder(w.owner)){
     await env.DB.prepare('UPDATE watches SET next_due=?,last_error=? WHERE id=?').bind(now+INTERVAL,'Monitoring paused: account no longer holds a Sentinel Body.',w.id).run();continue;
    }
    const o=await observe(w.network,w.account);
    await env.DB.batch([
     env.DB.prepare('INSERT OR IGNORE INTO observations(watch_id,observed_at,block_height,block_hash,block_timestamp_ns,amount,locked,storage_usage,source) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM watches WHERE id=?)').bind(w.id,o.observed_at,o.block_height,o.block_hash,o.block_timestamp_ns,o.amount,o.locked,o.storage_usage,o.source,w.id),
     env.DB.prepare('UPDATE watches SET next_due=?,last_error=NULL WHERE id=?').bind(Date.now()+INTERVAL,w.id),
     env.DB.prepare('DELETE FROM observations WHERE watch_id=? AND block_hash NOT IN (SELECT block_hash FROM observations WHERE watch_id=? ORDER BY block_height DESC LIMIT 96)').bind(w.id,w.id)
    ]);observed++;
   }catch(e){failed++;await env.DB.prepare('UPDATE watches SET next_due=?,last_error=? WHERE id=?').bind(Date.now()+300000,String((e as Error).message).slice(0,200),w.id).run();}
  }
  console.log(JSON.stringify({event:'monitor-round',observed,failed}));return {observed,failed};
 }finally{await env.DB.prepare("DELETE FROM monitor_lock WHERE id='collector' AND token=?").bind(token).run();}
}
