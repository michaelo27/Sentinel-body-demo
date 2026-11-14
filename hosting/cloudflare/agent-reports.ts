import { HttpError, pool, CONTRACT } from './platform';
import {canonicalize,sha256HexBrowser} from '../../packages/core/src/canonical';
export const REPORT_ROLE='holder-monitoring-report-publisher';
function packet(row:any){return {payload:JSON.parse(row.payload_json),content_hash:row.content_hash};}
export async function agentReportApi(path:string,method:string,body:any,owner:string,env:any){
 if(path==='/api/agent-reports/prepare'&&method==='POST'){
  if(body.consent!==true)throw new HttpError(400,'Confirm that the report hash and agent/token linkage will be public.');
  const tokenId=String(body.token_id??'');if(!/^(0|[1-9]\d{0,3})$/.test(tokenId)||typeof body.report_id!=='string'||body.report_id.length>80)throw new HttpError(400,'Valid NFT ID and report ID required.');
  const token:any=await pool.viewFunction(CONTRACT,'nft_token',{token_id:tokenId});
  if(token?.owner_id!==owner)throw new HttpError(403,'This NFT is not currently owned by your authenticated holder account.');
  const agent=await pool.viewFunction(CONTRACT,'agent_account_of',{token_id:tokenId});
  if(agent!==`agent-${tokenId}.${CONTRACT}`)throw new HttpError(409,'Unexpected agent mapping.');
  const report=await env.DB.prepare("SELECT r.* FROM ai_reports r JOIN watches w ON r.watch_id=w.id AND r.owner=w.owner WHERE r.id=? AND r.owner=? AND r.status='complete'").bind(body.report_id,owner).first();
  if(!report)throw new HttpError(404,'Completed report for an existing owned watch not found.');
  const existing=await env.DB.prepare('SELECT * FROM agent_report_tasks WHERE owner=? AND report_id=? AND token_id=?').bind(owner,report.id,tokenId).first();
  if(existing)return {...packet(existing),cached:true};
  const id='buddy-report-'+crypto.randomUUID();
  const payload={schema:'sentinel-buddies-agent-report-v1',snapshot_id:id,contract:CONTRACT,network:'testnet',token_id:tokenId,agent_account:agent,holder_at_preparation:owner,role:REPORT_ROLE,prepared_at:Date.now(),execution:{observation_collector:'Cloudflare Worker',analysis_provider:'NEAR AI Cloud',publication:'Operator-triggered local process using restricted agent signing key; not autonomous execution'},report:{id:report.id,created:report.created,model:report.model,evidence:JSON.parse(report.evidence_json),result:JSON.parse(report.result_json)},limitations:['Commitment proves report-byte consistency and the publishing agent account, not AI correctness or the cause of balance changes.','Private report body is not uploaded to chain. Hash and agent/token linkage are public.','Only the newest contract snapshot-limit commitments are retained.','Holder ownership checked by application and local publisher, not enforced as report authorization by publish_snapshot itself.']};
  const json=canonicalize(payload);if(json.length>24000)throw new HttpError(413,'Report exceeds bounded export size.');
  const hash=await sha256HexBrowser(json);
  const row=await env.DB.prepare('INSERT INTO agent_report_tasks(id,owner,report_id,watch_id,token_id,agent_account,content_hash,payload_json,created) SELECT ?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM agent_report_tasks)<40 ON CONFLICT(owner,report_id,token_id) DO NOTHING RETURNING id').bind(id,owner,report.id,report.watch_id,tokenId,agent,hash,json,payload.prepared_at).first();
  if(!row)throw new HttpError(409,'Task limit reached or duplicate preparation. Refresh execution history.');
  return {payload,content_hash:hash,cached:false};
 }
 if(path==='/api/agent-reports/history'&&method==='GET'){
  const {results}=await env.DB.prepare('SELECT t.* FROM agent_report_tasks t JOIN watches w ON t.watch_id=w.id AND t.owner=w.owner WHERE t.owner=? ORDER BY t.created DESC LIMIT 5').bind(owner).all();
  const items=[];
  for(const row of results){let commitment:any=null,verification='not-found-in-retained-history';
   try{commitment=await pool.viewFunction(CONTRACT,'snapshot_by_id',{id:row.id});if(commitment)verification=commitment.content_hash===row.content_hash&&commitment.token_id===row.token_id&&commitment.agent_account===row.agent_account?'verified-on-chain':'commitment-mismatch';}catch{verification='rpc-unavailable';}
   items.push({id:row.id,report_id:row.report_id,token_id:row.token_id,agent_account:row.agent_account,role:REPORT_ROLE,created:row.created,content_hash:row.content_hash,verification,commitment,...packet(row)});
  }
  return {items,publication_mode:'operator-triggered-local',note:'Prepared is not published. Missing commitment can mean not published or pruned; RPC errors are not proof of absence. Only the newest five prepared tasks are shown. No signing keys are stored in this Worker.'};
 }
 throw new HttpError(405,'Unsupported agent report operation.');
}
