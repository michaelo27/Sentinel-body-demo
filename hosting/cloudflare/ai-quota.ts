import {HttpError} from './platform';
// Called only after an atomic reservation fails; never authorizes a model request.
export async function quotaFailure(env:any,owner:string,now:number):Promise<never>{
 const day=Math.floor(now/86400000)*86400000;
 const counts=await env.DB.prepare('SELECT COUNT(*) AS lifetime, COALESCE(SUM(CASE WHEN created>=? THEN 1 ELSE 0 END),0) AS global_today, COALESCE(SUM(CASE WHEN owner=? AND created>=? THEN 1 ELSE 0 END),0) AS holder_today, MAX(CASE WHEN owner=? THEN created ELSE NULL END) AS last_attempt FROM ai_reports').bind(day,owner,day,owner).first();
 const reset=new Date(day+86400000).toISOString();
 let message:string;
 if(Number(counts?.lifetime)>=40)message='The demo lifetime limit of 40 AI attempts has been reached. Waiting for tomorrow will not reset it.';
 else if(Number(counts?.holder_today)>=10)message=`Your daily AI limit is reached (${counts.holder_today}/10 attempts). Resets at ${reset} (1:00 a.m. Lagos time). The shared global allowance may also be exhausted.`;
 else if(Number(counts?.global_today)>=10)message=`The shared daily AI limit is reached (${counts.global_today}/10 attempts across all holders). Resets at ${reset} (1:00 a.m. Lagos time).`;
 else if(counts?.last_attempt!==null&&Number(counts?.last_attempt)>now-60000)message=`AI cooldown: wait approximately ${Math.max(1,Math.ceil((Number(counts.last_attempt)+60000-now)/1000))} seconds after your previous attempt.`;
 else message='An AI attempt for this evidence may already be reserved. Reopen its history to check the recorded status before doing anything else.';
 throw new HttpError(429,message+' No new model call was made by this rejected request. Failed and pending attempts count.');
}
