/** Read-only preflight. No key access, signatures, transactions or deployment. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {viewFunction,viewAccount} from './near-tx.mjs';
const root=path.resolve(import.meta.dirname,'..');
const local=process.argv.includes('--local');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'config/nft-artwork-v1.json'),'utf8'));
const seen=new Set();
for (const [id,a] of manifest.entries.entries()) {
 const bytes=fs.readFileSync(path.join(root,'apps/web/public',new URL(a.media).pathname));
 const h=crypto.createHash('sha256').update(bytes).digest('base64');
 if(h!==a.media_hash||seen.has(h))throw Error('Local hash mismatch or duplicate artwork');
 seen.add(h);console.log(`Token #${id}: ${a.name}; local image hash OK`);
 if(!local){
  const res=await fetch(a.media,{signal:AbortSignal.timeout(20000),cache:'no-store'});
  if(!res.ok||!res.headers.get('content-type')?.startsWith('image/'))throw Error(`Public image not ready: ${a.media}. Publish the content-addressed assets to Vercel first.`);
  const data=Buffer.from(await res.arrayBuffer());
  if(crypto.createHash('sha256').update(data).digest('base64')!==h)throw Error('Public media bytes differ from registered hash. STOP.');
  console.log(`Token #${id}: public image hash OK`);
 }
}
if(!local){
 const rpc='https://test.rpc.fastnear.com',contract='sntl-02e90eacb8.testnet';
 const config=await viewFunction(rpc,contract,'config',{});
 const tokens=await viewFunction(rpc,contract,'nft_tokens',{from_index:'0',limit:50});
 const account=await viewAccount(rpc,contract);
 if(config.admin!=='sntl-owner-02e90eacb8.testnet')throw Error('Unexpected administrator. STOP.');
 if(Number(config.next_token_id)>manifest.entries.length)throw Error('Art set does not cover all reserved token IDs. STOP.');
 const agents={};for(const t of tokens)agents[t.token_id]=await viewFunction(rpc,contract,'agent_account_of',{token_id:t.token_id});
 const report={checked_at:new Date().toISOString(),contract,code_hash:account.code_hash,config,tokens,agents,manifest};
 const dir=path.join(root,'deployments');fs.mkdirSync(dir,{recursive:true});
 const out=path.join(dir,`nft01-readonly-check-${Date.now()}.json`);fs.writeFileSync(out,JSON.stringify(report,null,2));
 console.log(`Read-only chain preflight saved: ${out}`);
 console.log(`Existing tokens: ${tokens.map(t=>`${t.token_id} owned by ${t.owner_id}`).join('; ')}`);
}
console.log('READ-ONLY CHECK PASSED. No keys read; no transactions sent.');
