import {Card} from './ui';
export function AgentEconomySummary({health,cost}:{health:any;cost:any}){
 return <div className="bento" style={{gap:16,marginTop:24,marginBottom:24}}>
  <Card className="col-6" style={{padding:24}}><h3 className="h3">Agent activity at a glance</h3><p className="num" style={{fontSize:26,marginTop:16}}>{health?.fleet?.active??'—'} / {health?.fleet?.agents??'—'} active</p><p>Historical custom model score: {health?.score??'—'}/100.</p><p className="small muted">An archived summary, not a live uptime check. The custom score includes neutral defaults where baseline evidence was absent; it is not an independently verified health rating. The full health gauge, confidence, coverage and individual signals remain below.</p></Card>
  <Card className="col-6" style={{padding:24}}><h3 className="h3">Saved running-budget example</h3><p className="num" style={{fontSize:26,marginTop:16}}>{typeof cost?.monthly?.total_usd==='number'?`$${cost.monthly.total_usd.toFixed(2)} / month`:'Budget unavailable'}</p><p className="small muted">The report’s saved scenario—not your bill. Use the full calculator below to change workload, compare chains and inspect network fees, AI costs, hosting and storage. This saved summary stays fixed when calculator settings change.</p></Card>
 </div>;
}
