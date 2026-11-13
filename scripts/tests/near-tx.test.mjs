import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { signAndSend, generateKeyPair, b58encode } from '../near-tx.mjs';

// No real keys, network calls or on-chain changes.
async function exercise(mode) {
  const saved = globalThis.fetch;
  const key = generateKeyPair();
  let broadcasts = 0, expectedHash;
  globalThis.fetch = async (_url, opts) => {
    const request = JSON.parse(opts.body);
    let result;
    if (request.method === 'status') result = {sync_info:{latest_block_hash:b58encode(Buffer.alloc(32,1))}};
    else if (request.method === 'query') result = {nonce:3};
    else {
      broadcasts++;
      const signed = Buffer.from(request.params.signed_tx_base64,'base64');
      expectedHash = b58encode(crypto.createHash('sha256').update(signed.subarray(0,-65)).digest());
      if (mode === 'timeout') throw new Error('simulated lost response');
      result = {status:{SuccessValue:''}, receipts_outcome:[]};
      if (mode === 'receipt-failure') result.receipts_outcome.push({outcome:{status:{Failure:{ActionError:'test'}}}});
      if (mode === 'unfinished') result.status = {SuccessReceiptId:'pending'};
    }
    return {ok:true,json:async()=>({result})};
  };
  try {
    const result = await signAndSend({urls:['https://mock-one','https://mock-two'], signerId:'alice.testnet',receiverId:'demo.testnet',...key,actions:[]});
    return {result, expectedHash, broadcasts};
  } catch (error) { return {error,broadcasts}; }
  finally { globalThis.fetch = saved; }
}
test('transaction ID hashes unsigned bytes, not signature bytes', async()=>{
  const x=await exercise('ok'); assert.ifError(x.error); assert.equal(x.result.txHash,x.expectedHash); assert.equal(x.result.success,true);
});
test('receipt failure makes transaction unsuccessful',async()=>{
  const x=await exercise('receipt-failure'); assert.ifError(x.error); assert.equal(x.result.success,false);
});
test('lost broadcast response does not trigger a newly signed retry',async()=>{
  const x=await exercise('timeout'); assert.match(x.error.message,/NOT retrying/); assert.equal(x.broadcasts,1);
});
test('unfinished status is not reported as success',async()=>{
  const x=await exercise('unfinished'); assert.match(x.error.message,/final execution status/); assert.equal(x.broadcasts,1);
});
