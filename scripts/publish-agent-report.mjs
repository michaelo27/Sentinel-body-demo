/** Operator-triggered report publisher. Default is read-only. Uses restricted key ONLY. */
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {pathToFileURL} from 'node:url';
const root=process.cwd(),rpc='https://test.rpc.fastnear.com',contract='sntl-02e90eacb8.testnet';
const t=await import(pathToFileURL(path.join(root,'scripts/near-tx.mjs')).href);
const arg=process.argv.indexOf('--packet');if(arg<0||!process.argv[arg+1])throw Error('Supply --packet with downloaded report JSON path.');
const file=path.resolve(process.argv[arg+1]);if(fs.statSync(file).size>65536)throw Error('Packet too large.');
const packet=JSON.parse(fs.readFileSync(file,'utf8')),p=packet.payload;
function canonical(v){if(v===null)return 'null';if(typeof v==='number'){if(!Number.isFinite(v))throw Error('Invalid number');return JSON.stringify(v);}if(['string','boolean'].includes(typeof v))return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';throw Error('Invalid payload value');}
const sha=b=>crypto.createHash('sha256').update(b).digest();
if(!p||p.schema!=='sentinel-buddies-agent-report-v1'||p.contract!==contract||p.network!=='testnet'||p.role!=='holder-monitoring-report-publisher'||!/^buddy-report-[a-f0-9-]{36}$/.test(p.snapshot_id)||!/^(0|[1-9]\d{0,3})$/.test(p.token_id))throw Error('Unrecognized task packet.');
const signerId=`agent-${p.token_id}.${contract}`;
if(p.agent_account!==signerId||!p.report?.result?.analysis||!p.report?.evidence?.sources?.length||p.report.evidence.sources.length>2)throw Error('Invalid report evidence or agent mapping.');
if(sha(Buffer.from(canonical(p))).toString('hex')!==packet.content_hash)throw Error('Report hash mismatch. STOP.');
const token=await t.viewFunction(rpc,contract,'nft_token',{token_id:p.token_id});
if(token?.owner_id!==p.holder_at_preparation)throw Error('NFT ownership changed since preparation. Holder must prepare a new authorized task.');
if(await t.viewFunction(rpc,contract,'agent_account_of',{token_id:p.token_id})!==signerId)throw Error('Agent mapping differs.');
const existing=await t.viewFunction(rpc,contract,'snapshot_by_id',{id:p.snapshot_id});
if(existing){if(existing.content_hash===packet.content_hash&&existing.agent_account===signerId&&existing.token_id===p.token_id){console.log('ALREADY PUBLISHED: matching on-chain commitment. No transaction sent.');process.exit(0);}throw Error('Existing snapshot ID conflicts.');}
const config=await t.viewFunction(rpc,contract,'config',{});
const keys=await t.viewAccessKeyList(rpc,signerId);const entry=keys.keys?.find(k=>k.public_key===config.default_worker_key);const permission=entry?.access_key?.permission?.FunctionCall;
if(keys.keys?.length!==1||!permission||permission.receiver_id!==contract||permission.method_names?.length!==1||permission.method_names[0]!=='publish_snapshot'||permission.allowance===null||BigInt(permission.allowance)<=0n)throw Error('Expected sole restricted publish_snapshot key with remaining allowance.');
console.log('REPORT PREFLIGHT PASSED');console.log('NFT: #'+p.token_id+'; holder: '+p.holder_at_preparation);console.log('Agent signer: '+signerId);console.log('Role: holder monitoring-report publisher');console.log('AI report: '+p.report.id);console.log('Snapshot ID: '+p.snapshot_id);console.log('SHA-256: '+packet.content_hash);console.log('Execution: local operator-triggered publication; not autonomous AI.');
if(!process.argv.includes('--approve-publish')){console.log('READ ONLY: no keys read; no transaction sent. Review packet contents before approving.');process.exit(0);}
const journal=path.join(path.dirname(file),p.snapshot_id+'-publication.json');if(fs.existsSync(journal))throw Error('Publication journal exists. Inspect its hash/status; do not retry blindly.');
const store=t.readKeystore(path.join(root,'keys'));if(store.accounts.contract.accountId!==contract||store.worker.publicKey!==entry.public_key)throw Error('Local restricted worker key does not match agent. Do not use old keys.');
const observed={};for(const source of p.report.evidence.sources){if(!Number.isSafeInteger(source.block_height))throw Error('Invalid source block height.');observed[source.id]={network:p.report.evidence.network,block_height:source.block_height,block_hash:source.block_hash};}
const status=await t.rpcCall(rpc,'status',[]);const key=await t.viewAccessKey(rpc,signerId,store.worker.publicKey);
const bytes=t.encodeTransaction({signerId,publicKey:store.worker.publicKey,nonce:BigInt(key.nonce)+1n,receiverId:contract,blockHash:status.result.sync_info.latest_block_hash,actions:[t.A.functionCall('publish_snapshot',{snapshot_id:p.snapshot_id,content_hash:packet.content_hash,methodology_version:'holder-monitoring-ai-v1',observed_block_heights:JSON.stringify(observed),uri_hint:''},30,0n)]});
const txHash=t.b58encode(sha(bytes)),signed=t.signTransaction(bytes,store.worker.privateKey);
fs.writeFileSync(journal,JSON.stringify({txHash,signerId,snapshot_id:p.snapshot_id,content_hash:packet.content_hash,status:'outcome-unconfirmed'},null,2),{flag:'wx'});
console.log('Publication transaction: '+txHash);
const response=await t.rpcCall(rpc,'broadcast_tx_commit',{signed_tx_base64:signed.toString('base64')});fs.writeFileSync(journal,JSON.stringify({txHash,signerId,snapshot_id:p.snapshot_id,response},null,2));
if(response.error)throw Error('Outcome uncertain. STOP and inspect journal; do not retry.');
const final=await t.txStatus(rpc,txHash,signerId);fs.writeFileSync(journal,JSON.stringify({txHash,signerId,snapshot_id:p.snapshot_id,final},null,2));
if(!final.status||!('SuccessValue' in final.status)||final.receipts_outcome?.some(r=>r.outcome?.status?.Failure))throw Error('Publication failed or uncertain. STOP.');
const execution=final.receipts_outcome.filter(r=>r.outcome?.executor_id===contract).at(-1);if(!execution)throw Error('Missing contract outcome.');
const read=await t.rpcQuery(rpc,{request_type:'call_function',account_id:contract,block_id:execution.block_hash,method_name:'snapshot_by_id',args_base64:Buffer.from(JSON.stringify({id:p.snapshot_id})).toString('base64')});const commitment=JSON.parse(Buffer.from(read.result).toString());
if(commitment?.content_hash!==packet.content_hash||commitment?.agent_account!==signerId||commitment?.token_id!==p.token_id)throw Error('Publication verification mismatch. STOP.');
fs.writeFileSync(journal,JSON.stringify({txHash,signerId,snapshot_id:p.snapshot_id,final,commitment,verified:true},null,2));
console.log('AGENT REPORT PUBLICATION VERIFIED');console.log('Agent '+signerId+' published report '+p.report.id);console.log('https://testnet.nearblocks.io/txns/'+txHash);console.log('Refresh Agent report execution history in Vault. No funds transferred; no NFT minted.');
