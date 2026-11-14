export const ECOSYSTEM_SOURCES = {
 tvl:'https://api.llama.fi/v2/historicalChainTvl/Near',
 dex:'https://api.llama.fi/overview/dexs/Near?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true',
 revenue:'https://api.llama.fi/overview/fees/Near?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyRevenue'
};
const number=(v:unknown):number|null=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
function series(v:any){if(!Array.isArray(v))throw Error('Source series missing');return v.map((p:any)=>({date:number(Array.isArray(p)?p[0]:p.date),value:number(Array.isArray(p)?p[1]:p.tvl)})).filter((p:any)=>p.date!==null&&p.value!==null).sort((a:any,b:any)=>a.date-b.date).slice(-32);}
export function normalizeTvl(raw:any){const points=series(raw);if(points.length<2)throw Error('TVL history incomplete');const latest=points.at(-1)!,previous=points.at(-2)!;const week=points.filter(p=>p.date!<=latest.date!-7*86400).at(-1);return {latest,previous,week:week??null,change_usd:latest.value!-previous.value!,change_percent:previous.value?((latest.value!-previous.value!)/previous.value)*100:null,week_change_usd:week?latest.value!-week.value!:null,points,source:ECOSYSTEM_SOURCES.tvl};}
export function normalizeOverview(raw:any,kind:'dex'|'revenue'){
 if(raw.chain!=='Near'||!Array.isArray(raw.protocols))throw Error('Unexpected chain data');
 const points=series(raw.totalDataChart);const protocols=raw.protocols.map((p:any)=>({name:String(p.displayName||p.name).slice(0,120),category:String(p.category||'Unclassified').slice(0,80),slug:typeof p.slug==='string'&&/^[a-z0-9-]+$/.test(p.slug)?p.slug:null,usd24h:number(p.total24h),usd7d:number(p.total7d),usd30d:number(p.total30d),methodology:typeof p.methodologyURL==='string'&&p.methodologyURL.startsWith('https://github.com/DefiLlama/')?p.methodologyURL:null})).sort((a:any,b:any)=>(b.usd24h??-1)-(a.usd24h??-1));
 const dexes=protocols.filter((p:any)=>p.category==='Dexs'),reportedDexes=dexes.filter((p:any)=>p.usd24h!==null);
 return {usd24h:number(raw.total24h),usd7d:number(raw.total7d),usd30d:number(raw.total30d),latest_chart_date:points.at(-1)?.date??null,protocols,points,dex_only_24h:kind==='dex'&&reportedDexes.length?reportedDexes.reduce((n:number,p:any)=>n+p.usd24h,0):null,dex_reported:reportedDexes.length,dex_tracked:dexes.length,source:ECOSYSTEM_SOURCES[kind]};
}
