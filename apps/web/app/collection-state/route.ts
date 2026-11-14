import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
const contract = 'sntl-02e90eacb8.testnet';
async function rpc(params: Record<string, unknown>) {
  const r = await fetch('https://test.rpc.fastnear.com', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'collection', method: 'query', params }), cache: 'no-store', signal: AbortSignal.timeout(12000) });
  const j = await r.json();
  if (!r.ok || j.error || !j.result) throw new Error('Testnet RPC unavailable');
  return j.result;
}
export async function GET() {
  try {
    const account = await rpc({ request_type: 'view_account', account_id: contract, finality: 'final' });
    async function view(method_name: string, args = {}) {
      const r = await rpc({ request_type: 'call_function', account_id: contract, block_id: account.block_hash, method_name, args_base64: Buffer.from(JSON.stringify(args)).toString('base64') });
      return JSON.parse(Buffer.from(r.result).toString());
    }
    const [config, entries, tokens] = await Promise.all([view('config'), view('collection_artwork'), view('nft_tokens', { from_index: '0', limit: 50 })]);
    if (!Array.isArray(entries) || !Array.isArray(tokens) || entries.length > 50) throw new Error('Unexpected collection response');
    return NextResponse.json({ contract, block_height: account.block_height, block_hash: account.block_hash, checked_at: new Date().toISOString(), paused: config.paused, next_token_id: config.next_token_id, remaining: Math.max(0, entries.length - Number(config.next_token_id)), entries, tokens }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Live collection state unavailable. No current availability or ownership is inferred.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
