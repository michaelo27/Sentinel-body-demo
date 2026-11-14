import {NextResponse} from 'next/server';
import {makeChainEvidence} from '@/lib/chain-evidence';
export const dynamic='force-dynamic';
export const maxDuration=60;
let cached:any=null,expires=0,pending:Promise<any>|null=null;
export async function GET(){try{if(!cached||Date.now()>=expires){if(!pending)pending=makeChainEvidence().then(v=>{cached=v;expires=Date.now()+300000;return v;}).finally(()=>{pending=null;});await pending;}return NextResponse.json(cached,{headers:{'Cache-Control':'public, max-age=30, s-maxage=300'}});}catch{return NextResponse.json({error:'Evidence sources unavailable. No figures invented.'},{status:503});}}
