import { Buffer } from 'node:buffer';
import { b58decode } from '../../packages/core/src/base58';
import { nep413Digest } from '../../packages/core/src/nep413';
export const CONTRACT = 'sntl-02e90eacb8.testnet';
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function rpc(params: any) {
  const r = await fetch('https://test.rpc.fastnear.com', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({jsonrpc:'2.0',id:'sentinel',method:'query',params:{finality:'final',...params}}), signal:AbortSignal.timeout(12000)});
  if(!r.ok) throw new HttpError(503,'Testnet RPC unavailable. Retry later.');
  const j:any=await r.json(); if(j.error) throw new HttpError(503,'Testnet RPC could not verify the requested state.'); return j.result;
}
export const pool = {
 async viewFunction(c:string,m:string,a:any){const r=await rpc({request_type:'call_function',account_id:c,method_name:m,args_base64:Buffer.from(JSON.stringify(a)).toString('base64')});return JSON.parse(Buffer.from(r.result).toString());},
 viewAccount(a:string){return rpc({request_type:'view_account',account_id:a});},
 viewAccessKeyList(a:string){return rpc({request_type:'view_access_key_list',account_id:a});},
 viewAccessKey(a:string,k:string){return rpc({request_type:'view_access_key',account_id:a,public_key:k});},
 async healthCheck(){return {status:'not-probed',note:'State is fetched on demand'};}
};
const enc = new TextEncoder();
const b64 = (s:string|Uint8Array) => Buffer.from(s).toString('base64url');
async function hmac(secret:string){if(!secret||secret.length<48)throw new HttpError(503,'Gateway JWT_SECRET not configured securely.');return crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function holder(a:string){return (await pool.viewFunction(CONTRACT,'is_holder',{account_id:a}))===true;}
async function rate(req:Request,env:any){
 const ip=req.headers.get('CF-Connecting-IP') || 'unknown'; const bucket=`${ip}:${Math.floor(Date.now()/60000)}`;
 const row=await env.DB.prepare('INSERT INTO auth_rate(bucket,n,expires) VALUES(?,1,?) ON CONFLICT(bucket) DO UPDATE SET n=n+1 RETURNING n').bind(bucket,Date.now()+120000).first();
 if(row.n>12)throw new HttpError(429,'Too many authentication requests. Wait one minute.');
}
export async function auth(path:string,req:Request,body:any,env:any){
 if(!env.DB)throw new HttpError(503,'D1 authentication binding is missing.');
 await hmac(env.JWT_SECRET); await rate(req,env);
 if(path.endsWith('/challenge')){
  if(typeof body.accountId!=='string'||body.accountId.length>64||!/^([a-z0-9]+[-_])*[a-z0-9]+(\.([a-z0-9]+[-_])*[a-z0-9]+)*\.testnet$/.test(body.accountId))throw new HttpError(400,'Valid testnet account required.');
  const nonce=Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64');
  const message=`Unlock the Sentinel Body vault for ${body.accountId}. This signature does not authorize a transaction or cost gas.`;
  const expires=Date.now()+300000;
  await env.DB.batch([
   env.DB.prepare('DELETE FROM challenges WHERE expires < ?').bind(Date.now()),
   env.DB.prepare('DELETE FROM auth_rate WHERE expires < ?').bind(Date.now()),
   env.DB.prepare('INSERT INTO challenges(nonce,account,message,recipient,expires) VALUES(?,?,?,?,?)').bind(nonce,body.accountId,message,CONTRACT,expires)
  ]);
  return {nonce,message,recipient:CONTRACT,expiresAt:new Date(expires).toISOString()};
 }
 const c=await env.DB.prepare('SELECT * FROM challenges WHERE nonce=? AND expires>?').bind(String(body.nonce||''),Date.now()).first();
 if(!c||c.account!==body.accountId||c.message!==body.message||c.recipient!==body.recipient)throw new HttpError(401,'Challenge mismatch or expired. Request a new challenge.');
 if(body.txHash)throw new HttpError(410,'Only NEP-413 authentication is enabled on this hosted gateway.');
 let valid=false;
 try {
  if(typeof body.publicKey!=='string'||!body.publicKey.startsWith('ed25519:'))throw Error('key');
  const pk=b58decode(body.publicKey.slice(8)); const sig=Buffer.from(body.signature,'base64');
  if(pk.length!==32||sig.length!==64)throw Error('length');
  if(body.callbackUrl!=null&&typeof body.callbackUrl!=='string')throw Error('callback');
  const k=await crypto.subtle.importKey('raw',pk,{name:'Ed25519'},false,['verify']);
  valid=await crypto.subtle.verify('Ed25519',k,sig,nep413Digest({message:c.message,recipient:c.recipient,nonce:Buffer.from(c.nonce,'base64'),callbackUrl:body.callbackUrl}));
 }catch{valid=false;}
 if(!valid)throw new HttpError(401,'Invalid NEP-413 signature.');
 const access=await pool.viewAccessKey(c.account,body.publicKey);
 if(access.permission!=='FullAccess')throw new HttpError(401,'NEP-413 requires a full-access key belonging to this account.');
 if(!await holder(c.account))throw new HttpError(403,'This account does not currently hold a Sentinel Body.');
 // Atomic consumption: only one parallel verification can issue a token.
 const consumed=await env.DB.prepare('DELETE FROM challenges WHERE nonce=? AND expires>? RETURNING nonce').bind(c.nonce,Date.now()).first();
 if(!consumed)throw new HttpError(401,'Challenge already used or expired.');
 const now=Math.floor(Date.now()/1000);
 const data=b64(JSON.stringify({alg:'HS256',typ:'JWT'}))+'.'+b64(JSON.stringify({sub:c.account,scope:'holder',aud:CONTRACT,iat:now,exp:now+600}));
 const signature=await crypto.subtle.sign('HMAC',await hmac(env.JWT_SECRET),enc.encode(data));
 return {token:data+'.'+b64(new Uint8Array(signature)),expires_in:600,method:'nep413'};
}
export async function guardRequest(headers:Record<string,string>,env:any){
 const token=(headers.authorization||'').replace(/^Bearer /,''); const parts=token.split('.');
 if(parts.length!==3)throw new HttpError(401,'Holder session missing. Prove ownership.');
 let p:any;
 try{
  const h=JSON.parse(Buffer.from(parts[0],'base64url').toString());
  if(h.alg!=='HS256')throw Error('algorithm');
  const valid=await crypto.subtle.verify('HMAC',await hmac(env.JWT_SECRET),Buffer.from(parts[2],'base64url'),enc.encode(parts[0]+'.'+parts[1]));
  if(!valid)throw Error('signature');
  p=JSON.parse(Buffer.from(parts[1],'base64url').toString());
  if(p.aud!==CONTRACT||p.scope!=='holder'||typeof p.sub!=='string'||!Number.isFinite(p.exp)||p.exp<=Date.now()/1000)throw Error('claims');
 }catch{throw new HttpError(401,'Holder session expired or invalid. Prove ownership again.');}
 if(!await holder(p.sub))throw new HttpError(403,'Access revoked: account no longer holds a Sentinel Body.');
 return {ok:true,accountId:p.sub};
}
