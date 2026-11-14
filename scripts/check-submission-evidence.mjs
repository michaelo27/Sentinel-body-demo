/** Public, dependency-free submission check. No keys, signatures, AI calls or transactions. Node >=20.19. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {viewFunction,viewAccessKeyList,txStatus} from './near-tx.mjs';
const rpc='https://test.rpc.fastnear.com',contract='sntl-02e90eacb8.testnet';
const id='buddy-report-3e62906f-f29a-472f-87d1-e5ef1da05b34';
const expected='fd14b92ed315ab1770a573b05aad87511e9dfba2859203a84a9d48907522c8df';
const txHash='EPrjhgDpKxA6s2PZwm9QvuiacqtRXYx1uyshv9ahN1zL',agent='agent-1.'+contract;
function assert(ok,message){if(!ok)throw Error(message);}
function canonical(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';}
const [config,art,token,mapping,commitment,tx,keys]=await Promise.all([
 viewFunction(rpc,contract,'config'),viewFunction(rpc,contract,'collection_artwork'),viewFunction(rpc,contract,'nft_token',{token_id:'1'}),viewFunction(rpc,contract,'agent_account_of',{token_id:'1'}),viewFunction(rpc,contract,'snapshot_by_id',{id}),txStatus(rpc,txHash,agent),viewAccessKeyList(rpc,agent)]);
assert(Array.isArray(art)&&art.length>=6,'Expected at least six registered artworks.');
assert(new Set(art.map(a=>a.media_hash)).size===art.length,'Duplicate registered artwork hash.');
assert(mapping===agent&&token,'Token #1 / agent mapping mismatch.');
assert(token.metadata.media===art[1].media&&token.metadata.media_hash===art[1].media_hash,'Token #1 metadata differs from Arctic registry entry.');
assert(tx.transaction?.signer_id===agent&&tx.transaction?.receiver_id===contract,'Publication transaction signer or receiver mismatch.');
assert(tx.status&&'SuccessValue' in tx.status&&!tx.receipts_outcome?.some(r=>r.outcome?.status?.Failure),'Publication transaction did not succeed.');
const publicationLogs=(tx.receipts_outcome||[]).flatMap(r=>r.outcome?.logs||[]);
assert(publicationLogs.some(l=>l.includes(id)&&l.includes(expected)),'Expected report/hash not found in transaction receipt logs.');
if(commitment)assert(commitment.content_hash===expected&&commitment.agent_account===agent&&commitment.token_id==='1','Retained report commitment mismatch.');
else console.log('NOTE: report no longer in bounded contract history. Successful transaction receipt still contains the ID/hash.');
assert(keys.keys.length===1,'Agent key count changed; inspect permissions.');
const p=keys.keys[0].access_key.permission.FunctionCall;
assert(p&&p.receiver_id===contract&&p.method_names.length===1&&p.method_names[0]==='publish_snapshot','Agent is not restricted to publishing snapshots.');
console.log('PASS: distinct registered artwork; NFT #1 metadata and agent mapping.');
console.log('PASS: agent #1 restricted publish_snapshot key (no FullAccess).');
console.log('PASS: real publication transaction signed by agent #1, matching report hash.');
console.log('Current owner #1: '+token.owner_id);
console.log('Current registered IDs: '+art.length+'; next reserved ID: '+config.next_token_id+'; paused: '+config.paused);
console.log('Report ID: '+id);console.log('Report SHA-256: '+expected);
console.log('Transaction: https://testnet.nearblocks.io/txns/'+txHash);
if(process.argv.includes('--media'))for(const [n,a] of art.entries()){
 const r=await fetch(a.media,{signal:AbortSignal.timeout(20000)});assert(r.ok,'Media HTTP failure for #'+n);
 const bytes=Buffer.from(await r.arrayBuffer());assert(crypto.createHash('sha256').update(bytes).digest('base64')===a.media_hash,'Media hash mismatch #'+n);console.log('PASS: public image #'+n+' bytes match registered hash.');
}
const packetArg=process.argv.indexOf('--packet');
if(packetArg>=0){
 const file=process.argv[packetArg+1];assert(file&&fs.statSync(file).size<65536,'Missing/oversize private packet.');
 const packet=JSON.parse(fs.readFileSync(file,'utf8'));assert(packet.payload?.snapshot_id===id,'Packet is not the documented submission report.');
 const hash=crypto.createHash('sha256').update(canonical(packet.payload)).digest('hex');assert(hash===expected&&packet.content_hash===hash,'Private report bytes do not match documented commitment.');console.log('PASS: supplied private packet canonical hash matches public commitment. Packet was NOT uploaded.');
}else console.log('LIMIT: private report body not supplied; commitment/receipt checked, not full report-byte recomputation. Use --packet <path> if the holder deliberately provides the packet.');
console.log('Read-only check complete. No keys read, model called, transaction signed or sent.');
