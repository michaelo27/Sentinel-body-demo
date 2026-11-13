import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import worker from './worker.mjs';
import {nep413Digest} from '../../packages/core/src/nep413';
import {b58encode} from '../../packages/core/src/base58';
const records=new Map<string,any>();
const DB={prepare(sql:string){return {args:[] as any[],bind(...a:any[]){this.args=a;return this;},async run(){return this.first();},async first(){const a=this.args;
if(sql.startsWith('INSERT INTO auth_rate'))return {n:1};
if(sql.startsWith('INSERT INTO challenges')){records.set(a[0],{nonce:a[0],account:a[1],message:a[2],recipient:a[3],expires:a[4]});return null;}
if(sql.startsWith('SELECT *')){const c=records.get(a[0]);return c&&c.expires>a[1]?c:null;}
if(sql.includes('RETURNING nonce')){const c=records.get(a[0]);if(!c||c.expires<=a[1])return null;records.delete(a[0]);return {nonce:a[0]};}
return null;
}}},async batch(xs:any[]){return Promise.all(xs.map(x=>x.run()));}};
const env={DB,JWT_SECRET:'test-only-'.repeat(8),ALLOWED_ORIGIN:'https://sentinel-test.vercel.app'};
const realFetch=globalThis.fetch;let owned=true,permission:any='FullAccess';
globalThis.fetch=async (_url:any,init:any)=>{const p=JSON.parse(init.body).params;let result:any;
if(p.request_type==='view_access_key')result={permission};
else if(p.request_type==='call_function')result={result:[...Buffer.from(JSON.stringify(p.method_name==='is_holder'?owned:null))]};
else result={};return Response.json({result});};
const call=(p:string,body?:any,token?:string,origin?:string)=>worker.fetch(new Request('https://worker.example'+p,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{}),...(origin?{Origin:origin}:{})},...(body?{body:JSON.stringify(body)}:{})}),env);
const {publicKey,privateKey}=crypto.generateKeyPairSync('ed25519');
const pub='ed25519:'+b58encode(publicKey.export({format:'der',type:'spki'}).subarray(-32));
async function signed(){const c=await (await call('/auth/challenge',{accountId:'michaelomario.testnet'})).json();return {...c,accountId:'michaelomario.testnet',publicKey:pub,signature:crypto.sign(null,nep413Digest({...c,nonce:Buffer.from(c.nonce,'base64')}),privateKey).toString('base64')};}
assert.equal((await call('/api/vault/latest')).status,401);
assert.equal((await call('/api/auth/attest-receipt',{})).status,410);
assert.equal((await call('/admin/run-now',{})).status,410);
assert.equal((await call('/auth/challenge',{accountId:'x.testnet'},undefined,'https://evil.example')).status,403);
let input=await signed();
assert.equal((await call('/auth/verify',{...input,message:'tampered'})).status,401);
assert.equal((await call('/auth/verify',{...input,signature:Buffer.alloc(64).toString('base64')})).status,401);
permission={FunctionCall:{}};assert.equal((await call('/auth/verify',input)).status,401);permission='FullAccess';
const results=await Promise.all([call('/auth/verify',input),call('/auth/verify',input)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,401]);
const token=(await results.find(r=>r.status===200)!.json()).token;
assert.equal((await call('/api/vault/latest',undefined,token)).status,200);
owned=false;assert.equal((await call('/api/vault/latest',undefined,token)).status,403);owned=true;
assert.equal((await call('/api/vault/latest',undefined,token+'x')).status,401);
input=await signed();records.get(input.nonce).expires=0;assert.equal((await call('/auth/verify',input)).status,401);
const v=await (await call('/api/public/verify?q=snap-1794592774-60af8391549c')).json();assert.equal(v.matches,true);
assert.equal((await call('/api/methodology')).status,200);
assert.equal((await call('/api/nft/1/art.svg')).status,200);
globalThis.fetch=realFetch;
console.log('PASS: hash match; public routes; unsigned denial; origin rejection; disabled admin/receipt; valid signature; wrong message/signature/function-call key rejection; atomic single-use challenge; expired challenge; holder revocation; tampered JWT. Mocked RPC/D1 under Node, not Cloudflare production.');
