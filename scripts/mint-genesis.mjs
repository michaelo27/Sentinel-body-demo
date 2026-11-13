/** Read-only by default. Explicit --execute permits a testnet Genesis mint only. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { A, NEAR, readKeystore, viewFunction, signAndSend } from './near-tx.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function main() {
  if (process.argv.includes('--help')) {
    console.log('node scripts/mint-genesis.mjs [--execute]\nDefault: read-only status. --execute requires ACK_FRESH_TESTNET_KEYS=YES and a fresh private local keystore. Never use the exposed Drive archive keys.');
    return;
  }
  const dep = JSON.parse(fs.readFileSync(path.join(root,'deployments/testnet.json'),'utf8'));
  const contractId = dep.nft_contract_id;
  if (dep.network !== 'testnet' || !contractId?.endsWith('.testnet')) throw new Error('Only named testnet accounts are supported');
  const rpc = 'https://test.rpc.fastnear.com';
  const existing = await viewFunction(rpc,contractId,'nft_token',{token_id:'0'});
  if (existing) { console.log(`Genesis already exists; no mint sent. Owner: ${existing.owner_id}`); return; }
  const cfg = await viewFunction(rpc,contractId,'config',{});
  console.log(`Contract: ${contractId}; mint quote: ${cfg.mint_cost_yocto} yoctoNEAR`);
  if (!process.argv.includes('--execute')) { console.log('Read-only check complete. No transaction sent. See --help.'); return; }
  if (process.env.ACK_FRESH_TESTNET_KEYS !== 'YES') throw new Error('Fresh-key acknowledgement required; see --help');
  const store = readKeystore(path.join(root,'keys'));
  const admin = store.accounts.admin;
  if (admin.accountId !== cfg.admin) throw new Error('Keystore admin does not match contract admin');
  const result = await signAndSend({urls:[rpc],signerId:admin.accountId,privateKey:admin.privateKey,publicKey:admin.publicKey,receiverId:contractId,actions:[A.functionCall('mint_genesis',{},300,BigInt(cfg.mint_cost_yocto)+NEAR/10n)]});
  if (!result.success) throw new Error(`Mint failed: ${JSON.stringify(result.failure)}`);
  console.log(`Executed transaction: ${result.txHash}. Confirm token #0 and agent keys with RPC before treating provisioning as complete.`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
