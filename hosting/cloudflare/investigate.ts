import {HttpError} from './platform';
import {formatNear} from './watchlist';
const RPC={mainnet:'https://free.rpc.fastnear.com',testnet:'https://test.rpc.fastnear.com'};
function validAccount(v:any){return typeof v==='string'&&v.length>=2&&v.length<=64&&/^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/.test(v);}
async function call(network:keyof typeof RPC,method:string,params:any){
 const r=await fetch(RPC[network],{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:'buddy-investigation',method,params}),signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw new HttpError(503,'The network is not responding. Try again later.');
 const reader=r.body?.getReader();if(!reader)throw new HttpError(503,'No network response.');let text='',n=0;const decoder=new TextDecoder();
 while(true){const chunk=await reader.read();if(chunk.done)break;n+=chunk.value.length;if(n>98304){await reader.cancel();throw new HttpError(413,'This account or transaction is too large for this quick check. Open it in the explorer.');}text+=decoder.decode(chunk.value,{stream:true});}
 const j=JSON.parse(text+decoder.decode());if(j.error||!j.result)throw new HttpError(404,'The network could not return this account or transaction. Check its ID, signer and network. Older transactions may need an archival explorer.');return j.result;
}
export async function investigate(body:any,owner:string,env:any){
 if(!Object.hasOwn(RPC,body.network)||!['account','transaction'].includes(body.mode))throw new HttpError(400,'Choose a network and a check type.');
 if(body.mode==='account'&&!validAccount(body.account))throw new HttpError(400,'Enter a valid NEAR account name.');
 if(body.mode==='transaction'&&(!validAccount(body.signer)||typeof body.hash!=='string'||! /^[1-9A-HJ-NP-Za-km-z]{40,50}$/.test(body.hash)))throw new HttpError(400,'Enter a transaction hash and the account that signed it.');
 const now=Date.now(),bucket=`investigate:${owner}:${Math.floor(now/60000)}`;
 await env.DB.prepare('DELETE FROM auth_rate WHERE expires < ?').bind(now).run();
 const limit=await env.DB.prepare('INSERT INTO auth_rate(bucket,n,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET n=n+1 RETURNING n').bind(bucket,now+120000).first();
 if(limit.n>5)throw new HttpError(429,'Please wait a minute. Each holder can run five investigations per minute.');
 const network=body.network as keyof typeof RPC;
 if(body.mode==='account'){
  const account=body.account;const state=await call(network,'query',{request_type:'view_account',account_id:account,finality:'final'});
  const [list,block]=await Promise.all([call(network,'query',{request_type:'view_access_key_list',account_id:account,block_id:state.block_hash}),call(network,'block',{block_id:state.block_hash})]);
  if(block.header?.hash!==state.block_hash||list.block_hash!==state.block_hash||!Array.isArray(list.keys))throw new HttpError(503,'The network returned inconsistent block references. No result shown.');
  const full=list.keys.filter((k:any)=>k.access_key.permission==='FullAccess').length;
  const scoped=list.keys.filter((k:any)=>k.access_key.permission?.FunctionCall).length;
  const installed=state.code_hash!=='11111111111111111111111111111111';
  const findings=[{title:installed?'This account has a smart contract':'No smart contract is installed',meaning:installed?'This account can run on-chain code. That tells us code exists, not whether it has been audited.':'It currently has no deployed contract code. It can still hold funds and sign transactions.'},{title:`${full} full-access ${full===1?'key':'keys'}`,meaning:full?'These keys can authorize transfers, change account keys and deploy code. Check that every full-access key is one you recognize.':'No full-access key appears in this account. Contract code or limited keys may still control what it can do.'},{title:`${scoped} limited ${scoped===1?'app key':'app keys'}`,meaning:scoped?'These keys can call specified contracts. Expand the list to see each destination and allowed methods.':'No function-call access keys were returned. This is an inventory, not a safety verdict.'}];
  const keys=list.keys.slice(0,20).map((k:any)=>{const fc=k.access_key.permission?.FunctionCall;return {public_key:k.public_key,type:k.access_key.permission==='FullAccess'?'Full access':fc?'Limited app access':'Other permission',receiver:fc?.receiver_id??null,methods:fc?.method_names?.slice(0,20)??[],method_count:fc?.method_names?.length??0,all_methods:!!fc&&fc.method_names?.length===0,allowance_near:fc?(fc.allowance===null?'No allowance cap':formatNear(fc.allowance)):null};});
  return {mode:'account',network,account,checked_at:now,block_height:state.block_height,block_hash:state.block_hash,block_time:new Date(Number(BigInt(block.header.timestamp_nanosec)/1000000n)).toISOString(),source:RPC[network],amount_near:formatNear(state.amount),locked_near:formatNear(state.locked),storage_bytes:state.storage_usage,code_hash:state.code_hash,findings,keys,key_count:list.keys.length,full_access_keys:full,limited_keys:scoped,scope:'Current native NEAR account state and access keys only. Token balances, staking positions, transaction history and the real-world identities behind keys are not included. Account amount is not a guaranteed spendable balance. No security score is inferred.'};
 }
 const tx=await call(network,'tx',{tx_hash:body.hash,sender_account_id:body.signer,wait_until:'FINAL'});
 if(tx.transaction?.hash!==body.hash||tx.transaction?.signer_id!==body.signer)throw new HttpError(503,'Transaction details did not match the request.');
 const outcomes=[tx.transaction_outcome,...(tx.receipts_outcome||[])].filter(Boolean);
 const failed=!!tx.status?.Failure||outcomes.some((r:any)=>r.outcome?.status?.Failure);
 const status=failed?'Failed':tx.status&&'SuccessValue' in tx.status?'Completed':'Not confirmed';
 let fees=0n;for(const r of outcomes){if(!/^\d+$/.test(r.outcome?.tokens_burnt??''))throw new HttpError(503,'Fee information is incomplete.');fees+=BigInt(r.outcome.tokens_burnt);}
 const actions=(tx.transaction.actions||[]).slice(0,20).map((a:any)=>{if(a.FunctionCall)return {type:'Contract call',method:String(a.FunctionCall.method_name).slice(0,100),deposit_near:formatNear(a.FunctionCall.deposit),detail:'Requested a contract method. Attached NEAR is not proof of the final amount received; refunds or other receipts may follow.'};if(a.Transfer)return {type:'NEAR transfer',deposit_near:formatNear(a.Transfer.deposit),detail:'A native NEAR transfer action. Check overall execution status before treating it as completed.'};return {type:Object.keys(a)[0]||String(a),detail:'Account-management action; inspect the explorer for full details.'};});
 return {mode:'transaction',network,hash:body.hash,signer:tx.transaction.signer_id,receiver:tx.transaction.receiver_id,status,checked_at:now,source:RPC[network],actions,action_count:tx.transaction.actions.length,fees_near:formatNear(fees.toString()),execution_accounts:[...new Set(outcomes.map((r:any)=>r.outcome?.executor_id).filter(Boolean))].slice(0,20),receipt_count:tx.receipts_outcome?.length??0,execution_block_hashes:[...new Set(outcomes.map((r:any)=>r.block_hash).filter(Boolean))],scope:'This explains one supplied transaction, not the account’s complete history. Execution accounts are not a map of money recipients. Token swaps and token amounts inside contract events are not decoded. Fees are NEAR tokens burnt across the returned transaction and receipt outcomes; refunds are separate.'};
}
