import { watchApi, runScheduled } from './watchlist';
import { aiApi } from './ai-analysis';
import { agentReportApi } from './agent-reports';
import { investigate } from './investigate';
import { missionApi } from './missions';
import { Buffer } from 'node:buffer';
import { hashSnapshot } from '../../packages/core/src/hash-node';
import { isValidContentHash } from '../../packages/core/src/canonical';
import { sentinelArtSvg } from '../../packages/core/src/art';
import { costModel, DEFAULT_SCENARIO, DEFAULT_ASSUMPTIONS } from '../../packages/core/src/cost-model';
import snapshot from './snapshot.json';
import methodologyData from '../../config/methodology.v1.json';
import assumptionsData from '../../config/assumptions.json';
import signalsData from '../../config/agent-signals.json';
import sourcesData from '../../config/sources.json';
import { CONTRACT, HttpError, pool, holder, auth, guardRequest } from './platform';
const methodology=()=>methodologyData, assumptions=()=>assumptionsData, agentSignals=()=>signalsData, sources=()=>sourcesData;
type SnapshotT = any;
const getActivity=()=>[], roundHistory=()=>[];
const clampNum=(v:any,lo:number,hi:number,d:number)=>Number.isFinite(Number(v))?Math.max(lo,Math.min(hi,Number(v))):d;
const dep={status:'deployed',genesis_agent_account:`agent-0.${CONTRACT}`};
const CFG={demoReplay:true,dataNetwork:'mainnet',publicDelayMinutes:15,runtimeVersion:'host01-saved-snapshot',roundIntervalMinutes:null};
const testPool=pool,dataPool=pool,contractId=CONTRACT;
const store={
 latest:()=>snapshot, previous:()=>null, count:()=>1,
 get:(id:string)=>id===snapshot.snapshot_id?snapshot:null,
 all:()=>[snapshot],
 list:()=>[{id:snapshot.snapshot_id,epoch_ts:snapshot.epoch_ts,content_hash:snapshot.proof.content_hash,tx:snapshot.proof.commitment_tx,mode:snapshot.meta.mode,stale:snapshot.meta.stale,agent_account:snapshot.meta.agent_account,methodology_version:snapshot.methodology_version}],
 isPublic:(id:string,delay:number)=>id===snapshot.snapshot_id && Date.parse(snapshot.epoch_ts)<=Date.now()-delay*60000,
 delayed:(delay:number)=>Date.parse(snapshot.epoch_ts)<=Date.now()-delay*60000?snapshot:null
};
function delivery(s: SnapshotT | null, tier: 'public' | 'holder') {
  return {
    tier,
    mode: 'replay', hosting_mode: 'saved-snapshot', automatic_publishing: false,
    replay: CFG.demoReplay,
    stale: s?.meta.stale || false,
    delay_minutes: CFG.publicDelayMinutes,
    age_minutes: s ? Math.max(0, Math.round((Date.now() - Date.parse(s.epoch_ts)) / 60000)) : null,
    served_at: new Date().toISOString(),
    observed_network: CFG.dataNetwork,
    settled_network: 'testnet',
  };
}

/** Public tier: headline scores + coarse chart ONLY. No breakdowns, no calculator. */
function publicView(s: SnapshotT | null) {
  if (!s) return null;
  return {
    schema: s.schema, snapshot_id: s.snapshot_id, epoch_ts: s.epoch_ts,
    methodology_version: s.methodology_version,
    headline: {
      capital_flow_net_near: s.capital_flow.total_net_near,
      cost_index_usd_per_month: s.cost_of_living.monthly.total_usd,
      agent_health: s.agent_health.score,
      agent_health_confidence: s.agent_health.confidence,
    },
    coarse_chart: s.capital_flow.cohorts.map((c) => ({ id: c.id, label: c.label, value: c.net_usd })),
    provenance: {
      observed_block_heights: s.inputs.blocks,
      price_observed_at: s.inputs.prices.price_observed_at,
      query_count: s.inputs.queries.length,
    },
    commitment: commitmentOf(s),
  };
}

function commitmentOf(s: SnapshotT) {
  return {
    content_hash: s.proof?.content_hash || null,
    commitment_tx: s.proof?.commitment_tx || null,
    commitment_status: s.proof?.commitment_status || 'unavailable',
    publisher_account: s.proof?.publisher_account || null,
    explorer_url: s.proof?.explorer_url || (s.proof?.commitment_tx ? `https://testnet.nearblocks.io/txns/${s.proof.commitment_tx}` : null),
    block_heights: s.inputs.blocks,
    methodology_version: s.methodology_version,
  };
}

async function chainCommitment() {
  try {
    const c = await testPool.viewFunction<any>(contractId, 'latest_snapshot', {});
    return c ? {
      snapshot_id: c.id, content_hash: c.content_hash, token_id: c.token_id,
      publisher_account: c.agent_account, block_height: c.block_height,
      block_timestamp: c.block_timestamp, methodology_version: c.methodology_version,
      observed_block_heights: (() => { try { return JSON.parse(c.observed_block_heights); } catch { return {}; } })(),
      explorer_url: null,
    } : null;
  } catch (e) { return { error: String((e as Error).message).slice(0, 180) }; }
}


function register(app:any,guard:any,isHolder:any){
app.get('/api/health', async () => {
  const [t, d] = await Promise.all([testPool.healthCheck(), dataPool.healthCheck()]);
  const latest = store.latest();
  const src = sources();
  return {
    status: 'ok', service: 'sentinel-intel-vault', runtime_version: CFG.runtimeVersion,
    settled_network: 'testnet', observed_network: CFG.dataNetwork,
    mode: CFG.demoReplay ? 'replay' : 'live',
    nft_contract_id: contractId,
    genesis_agent_account: dep.genesis_agent_account,
    deployment_status: dep.status,
    rpc: { testnet: t, [CFG.dataNetwork]: d },
    latest_snapshot: latest ? { id: latest.snapshot_id, epoch_ts: latest.epoch_ts, hash: latest.proof?.content_hash, tx: latest.proof?.commitment_tx } : null,
    snapshots_stored: store.count(),
    sources: { checked_at: src.checked_at, checks: src.results.length, live: src.results.filter((r: any) => r.live).length },
    round_interval_minutes: CFG.roundIntervalMinutes,
    public_delay_minutes: CFG.publicDelayMinutes,
  };
});

app.get('/api/methodology', async () => ({ methodology: methodology(), assumptions: assumptions(), agent_signals: agentSignals() }));
app.get('/api/sources', async () => {
  const s = sources();
  return { checked_at: s.checked_at, total: s.results.length, live: s.results.filter((r: any) => r.live).length,
    expected_degraded: s.results.filter((r: any) => r.expected_degraded).map((r: any) => r.id),
    results: s.results };
});

// --------------------------------------------------------------- public tier
app.get('/api/public/latest', async () => {
  const delayed = store.delayed(CFG.publicDelayMinutes);
  return {
    delivery: delivery(delayed, 'public'),
    snapshot: publicView(delayed),
    live_commitment: await chainCommitment(),
    locked: {
      title: 'Live full-resolution intelligence',
      unlocked_by: 'Holding a Sentinel Body',
      real_latest_hash: store.latest()?.proof?.content_hash || null,
    },
  };
});

app.get('/api/public/commitment', async () => ({ commitment: await chainCommitment(), note: 'On-chain commitments are public. Only the computed intelligence is gated.' }));
app.get('/api/public/commitments', async () => {
  const commits = await testPool.viewFunction<any[]>(contractId, 'snapshots', { from: 0, limit: 50 }).catch(() => []);
  return {
    note: `Direct view call to ${CONTRACT}.snapshots — on-chain commitments are public.`,
    items: (commits || []).slice().reverse().map((c: any) => {
      const local = store.get(c.id);
      return {
        ...c,
        explorer_url: local?.proof?.commitment_tx ? `https://testnet.nearblocks.io/txns/${local.proof.commitment_tx}` : null,
        commitment_tx: local?.proof?.commitment_tx || null,
        public_after_delay: store.isPublic(c.id, CFG.publicDelayMinutes),
        in_vault: !!local,
      };
    }),
  };
});

app.get('/api/public/holder', async (req) => {
  const account = String((req.query as any).account || '');
  return { account_id: account, is_holder: /^[a-z0-9._-]+\.testnet$/.test(account) ? await isHolder(account, testPool) : false, checked_at: new Date().toISOString(), source: `view call: ${CONTRACT}.is_holder` };
});

app.get('/api/public/snapshot/:id', async (req, reply) => {
  const { id } = req.params as { id: string };
  if (!store.isPublic(id, CFG.publicDelayMinutes)) return reply.code(403).send({ error: 'This snapshot is still inside the public delay window.' });
  const s = store.get(id);
  if (!s) return reply.code(404).send({ error: 'Snapshot not found.' });
  // ?full=1 releases the COMPLETE delayed snapshot so anyone can recompute the
  // hash in their own browser with WebCrypto. Live snapshots stay holder-only.
  if ((req.query as any)?.full === '1') {
    return { delivery: { ...delivery(s, 'public'), released_full_snapshot: true }, snapshot: s, commitment: commitmentOf(s), recomputed_hash: hashSnapshot(s), note: 'Full-resolution data is released only after the public delay. Verify the hash locally with WebCrypto; do not trust this recomputed_hash field.' };
  }
  return { delivery: delivery(s, 'public'), snapshot: publicView(s) };
});

/** Interactive Cost-of-Living calculator: the SAME pure function the runtime uses. */
app.post('/api/cost/quote', async (req, reply) => {
  const s = store.latest();
  if (!s) return reply.code(503).send({ error: 'No live snapshot yet; cannot quote without real parameters.' });
  const body = (req.body || {}) as any;
  const modelId = String(body.model || DEFAULT_SCENARIO.model);
  const model = (assumptions().inference?.models || []).find((m: any) => m.id === modelId) || null;
  if (!model) return reply.code(400).send({ error: 'Unknown model. Choose one from /api/methodology.' });
  const scenario = {
    agents: clampNum(body.agents, 1, 10000, 10), txPerAgentDay: clampNum(body.txPerAgentDay, 1, 100000, 100),
    avgTgasPerTx: clampNum(body.avgTgasPerTx, 0.01, 300, 0.3), persistentStorageMB: clampNum(body.persistentStorageMB, 0, 10000, 1),
    inferenceTokensPerDay: clampNum(body.inferenceTokensPerDay, 0, 1e9, 200000), model: modelId,
    infraUsdPerMonth: clampNum(body.infraUsdPerMonth, 0, 1e7, 0),
  };
  const i = s.inputs;
  const live = {
    nearGasPriceYocto: i.gas.near_gas_price_yocto, storageByteCostYocto: i.gas.near_storage_byte_cost_yocto,
    nearUsd: i.prices.near_usd, ethUsd: i.prices.eth_usd, solUsd: i.prices.sol_usd,
    ethGasPriceWei: i.gas.eth_gas_price_wei, baseGasPriceWei: i.gas.base_gas_price_wei,
    solRentLamports128b: i.gas.sol_rent_lamports_128b, solBaseFeeLamports: i.gas.sol_base_fee_lamports,
    modelInputUsdPer1m: model.input_usd_per_1m, modelOutputUsdPer1m: model.output_usd_per_1m,
  };
  return {
    scenario, result: costModel(scenario, live, DEFAULT_ASSUMPTIONS),
    live_params: { ...i.gas, ...i.prices, model_id: modelId, model_kind: 'published_catalog', model_source: assumptions().inference.source_url },
    provenance: { snapshot_id: s.snapshot_id, epoch_ts: s.epoch_ts, observed_block_heights: i.blocks, mode: s.meta.mode, stale: s.meta.stale },
    labels: { model: 'Published catalog', gas: 'Live RPC', storage: 'Live RPC (locked capital, not spent)', evm_gas_units: 'ASSUMPTION', sol_signatures: 'ASSUMPTION', utilization: 'ASSUMPTION', inference_split: 'ASSUMPTION' },
  };
});

app.get('/api/public/verify', async (req) => {
  const q = String((req.query as any).q || '').trim();
  if (!q) return { error: 'Provide ?q=<snapshot_id or 64-char hash>' };
  const all = store.all();
  let s = all.find((x) => x.snapshot_id === q) || null;
  if (!s && isValidContentHash(q)) s = all.find((x) => x.proof?.content_hash === q) || null;
  if (!s) {
    // fall back to the on-chain commitment view (public, no vault needed)
    const commits = await testPool.viewFunction<any[]>(contractId, 'snapshots', { from: 0, limit: 50 }).catch(() => []);
    const c = (commits || []).find((x) => x.id === q || x.content_hash === q);
    if (c) return { found: true, source: 'on-chain', commitment: c, vault_snapshot: null, note: 'The commitment is public; the full snapshot is released after the public delay.' };
    return { found: false, error: 'No commitment matches that ID or hash.' };
  }
  const chain = await testPool.viewFunction<any>(contractId, 'snapshot_by_id', { id: s.snapshot_id });
  return {
    found: true, source: 'vault',
    commitment: { ...commitmentOf(s), id: s.snapshot_id, agent_account: s.proof?.publisher_account, ...(chain || {}) },
    recomputed_hash: hashSnapshot(s),
    matches: !!chain && hashSnapshot(s) === chain.content_hash && chain.content_hash === s.proof?.content_hash,
    public_after_delay: store.isPublic(s.snapshot_id, CFG.publicDelayMinutes),
    vault_snapshot: store.isPublic(s.snapshot_id, CFG.publicDelayMinutes) ? publicView(s) : null,
  };
});

// ---------------------------------------------------------------- holder tier
app.get('/api/vault/latest', async (req, reply) => {
  if (!(await guard(req, reply))) return;
  const s = store.latest();
  if (!s) return reply.code(404).send({ error: 'No snapshot yet. Run pnpm agent:run.' });
  return { delivery: delivery(s, 'holder'), snapshot: s, commitment: commitmentOf(s), previous: store.previous()?.snapshot_id || null };
});

app.get('/api/vault/history', async (req, reply) => {
  if (!(await guard(req, reply))) return;
  return { delivery: delivery(store.latest(), 'holder'), items: store.list(Number((req.query as any).limit || 50)) };
});

app.get('/api/snapshot/:id', async (req, reply) => {
  if (!(await guard(req, reply))) return;
  const { id } = req.params as { id: string };
  const s = store.get(id);
  if (!s) return reply.code(404).send({ error: 'Snapshot not found.' });
  return { delivery: delivery(s, 'holder'), snapshot: s, commitment: commitmentOf(s), recomputed_hash: hashSnapshot(s) };
});

// ---------------------------------------------------------------- agent console
app.get('/api/agent/:id', async (req) => {
  const { id } = req.params as { id: string };
  const account = await testPool.viewFunction<string | null>(contractId, 'agent_account_of', { token_id: id }).catch(() => null);
  const token = await testPool.viewFunction<any>(contractId, 'nft_token', { token_id: id }).catch(() => null);
  if (!account || !token) return { error: 'Agent not found', token_id: id };
  const state = await testPool.viewAccount(account).catch(() => null);
  const keys = await testPool.viewAccessKeyList(account).catch(() => ({ keys: [] }));
  const commits = await testPool.viewFunction<any[]>(contractId, 'snapshots', { from: 0, limit: 50 }).catch(() => []);
  const own = (commits || []).filter((c) => c.agent_account === account);
  return {
    token_id: id, owner_id: token.owner_id, agent_account: account,
    balance_near: state ? Number(BigInt(state.amount)) / 1e24 : null,
    storage_usage_bytes: state?.storage_usage ?? null,
    access_keys: keys.keys,
    no_full_access_key: !keys.keys.some((k: any) => k.access_key.permission === 'FullAccess'),
    commitments: own,
    activity: getActivity().slice(0, 20),
    rounds: roundHistory().slice(0, 10),
    explorer_url: `https://testnet.nearblocks.io/accounts/${account}`,
  };
});

app.get('/api/mint/quote', async () => {
  const cfg = await testPool.viewFunction<any>(contractId, 'config', {}).catch(() => null);
  return {
    contract_id: contractId,
    next_token_id: cfg?.next_token_id ?? null,
    mint_cost_near: cfg ? Number(BigInt(cfg.mint_cost_yocto)) / 1e24 : null,
    breakdown: {
      controller_wasm_bytes: cfg?.controller_wasm_bytes,
      storage_cost_per_byte_yocto: cfg?.storage_byte_cost_yocto,
      seed_balance_near: cfg?.seed_balance_near,
      worker_allowance_near: cfg?.worker_allowance_near,
      note: 'About 1 NEAR per 100 KB of locked storage, so each agent costs ~1.9 free TESTNET NEAR. See contracts/README.md.',
    },
    explorer_url: `https://testnet.nearblocks.io/accounts/${contractId}`,
  };
});

// ------------------------------------------------------------------ dynamic art
app.get('/api/nft/:id/art.svg', async (req, reply) => {
  const { id } = req.params as { id: string };
  const account = await testPool.viewFunction<string | null>(contractId, 'agent_account_of', { token_id: id }).catch(() => null);
  const commits = await testPool.viewFunction<any[]>(contractId, 'snapshots', { from: 0, limit: 50 }).catch(() => []);
  const own = (commits || []).filter((c) => c.agent_account === account);
  const last = own.length ? Number(own[own.length - 1]!.block_timestamp) : 0;
  const state = account ? await testPool.viewAccount(account).catch(() => null) : null;
  const lowFuel = state ? Number(BigInt(state.amount)) / 1e24 < 0.4 : false;
  const svg = await sentinelArtSvg(id, account || `agent-${id}.${contractId}`, {
    publishes: own.length,
    lastPublishMsAgo: last ? Date.now() - last : 1e12,
    lowFuel,
  });
  reply.header('Content-Type', 'image/svg+xml; charset=utf-8');
  reply.header('Cache-Control', 'public, max-age=30');
  return svg;
});


}

export default {
 async scheduled(_event:any,env:any,ctx:any){ctx.waitUntil(runScheduled(env));},
 async fetch(request:Request,env:any):Promise<Response>{
  const headers:Record<string,string>={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
  const origin=request.headers.get('Origin');
  if(origin && origin===env.ALLOWED_ORIGIN){headers['Access-Control-Allow-Origin']=origin;headers['Access-Control-Allow-Headers']='Content-Type, Authorization';headers['Access-Control-Allow-Methods']='GET, POST, OPTIONS';}
  const json=(v:any,status=200)=>new Response(JSON.stringify(v),{status,headers:{...headers,'Content-Type':'application/json'}});
  try{
   if(origin && origin!==env.ALLOWED_ORIGIN)throw new HttpError(403,'Origin not allowed. Use the configured production website.');
   if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
   if(!['GET','POST'].includes(request.method))throw new HttpError(405,'Method not allowed.');
   const url=new URL(request.url); let body:any={};
   if(request.method==='POST'){
    // Read with a hard cap before JSON parsing.
    const reader=request.body?.getReader(); const chunks:Uint8Array[]=[];let size=0;
    if(reader){while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>16384){await reader.cancel();throw new HttpError(413,'Body too large.');}chunks.push(r.value);}}
    try{body=JSON.parse(Buffer.concat(chunks).toString()||'{}');if(!body||Array.isArray(body)||typeof body!=='object')throw Error();}catch{throw new HttpError(400,'JSON object required.');}
   }
   if(['/auth/challenge','/auth/verify','/api/auth/challenge','/api/auth/verify'].includes(url.pathname)){
    if(request.method!=='POST')throw new HttpError(405,'POST required.');
    return json(await auth(url.pathname,request,body,env));
   }
   if(['/api/missions/state','/api/missions/profile','/api/missions/collect','/api/missions/open','/api/missions/review','/api/missions/analyze'].includes(url.pathname)){
    const session=await guardRequest(Object.fromEntries(request.headers),env);
    return json(await missionApi(url.pathname,request.method,body,session.accountId,env));
   }
   if(url.pathname==='/api/investigate'){
    if(request.method!=='POST')throw new HttpError(405,'POST required.');
    const session=await guardRequest(Object.fromEntries(request.headers),env);
    return json(await investigate(body,session.accountId,env));
   }
   if(['/api/agent-reports/prepare','/api/agent-reports/history'].includes(url.pathname)){
    const session=await guardRequest(Object.fromEntries(request.headers),env);
    return json(await agentReportApi(url.pathname,request.method,body,session.accountId,env));
   }
   if(['/api/ai/explain','/api/ai/history'].includes(url.pathname)){
    const session=await guardRequest(Object.fromEntries(request.headers),env);
    return json(await aiApi(url.pathname,request.method,body,session.accountId,env));
   }
   if(['/api/watchlist','/api/watchlist/remove'].includes(url.pathname)){
    const session=await guardRequest(Object.fromEntries(request.headers),env);
    return json(await watchApi(url.pathname,request.method,body,session.accountId,env));
   }
   if(url.pathname.startsWith('/admin/')||url.pathname.startsWith('/api/demo/')||url.pathname==='/api/auth/attest-receipt')throw new HttpError(410,'Disabled on the hosted saved-snapshot demo.');
   const app:any={routes:[],get(p:string,h:any){this.routes.push(['GET',p,h]);},post(p:string,h:any){this.routes.push(['POST',p,h]);}};
   const isHolder=(a:string)=>holder(a);
   const guard=async(req:any,_reply:any)=>guardRequest(req.headers,env);
   register(app,guard,isHolder);
   for(const [method,path,handler] of app.routes){
    if(method!==request.method)continue;
    const names:string[]=[]; const pattern=path.split('/').map((p:string)=>{if(p.startsWith(':')){names.push(p.slice(1));return '([^/]+)';}return p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}).join('/');
    const match=url.pathname.match(new RegExp('^'+pattern+'$'));if(!match)continue;
    const params:any={};names.forEach((n,i)=>params[n]=decodeURIComponent(match[i+1]));
    let status=200,sent=false,payload:any;
    const reply:any={code(n:number){status=n;return this;},header(k:string,v:string){headers[k]=v;return this;},send(v:any){sent=true;payload=v;return v;}};
    const result=await handler({params,query:Object.fromEntries(url.searchParams),body,headers:Object.fromEntries(request.headers)},reply);
    const value=sent?payload:result;
    return typeof value==='string'?new Response(value,{status,headers}):json(value??null,status);
   }
   throw new HttpError(404,'Route not found.');
  }catch(e:any){console.error(e instanceof HttpError ? e.message : String(e));return json({error:e instanceof HttpError?e.message:'Gateway request failed. Please retry later.'},e instanceof HttpError?e.status:503);}
 }
};
