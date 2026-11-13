/**
 * Create the free testnet accounts needed by the deployment, using the public
 * NEAR testnet faucet. Verified 2026-11-12: POST helper.nearprotocol.com/account
 * with {newAccountId, newAccountPublicKey} returns a real tx outcome.
 *
 * Keys are written to keys/testnet.json (gitignored, mode 600). Public metadata
 * goes to deployments/testnet.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { generateKeyPair, viewAccount, writeKeystore, readKeystore } from './near-tx.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const RPC = process.env.RPC_TESTNET || 'https://test.rpc.fastnear.com';
const FAUCET = 'https://helper.nearprotocol.com/account';
const KEYDIR = path.join(ROOT, 'keys');
const NAMES = [
  { key: 'contract', id: process.env.NFT_CONTRACT_ID || 'sentinel-body.testnet' },
  { key: 'admin', id: process.env.ADMIN_ACCOUNT_ID || 'sentinel-owner.testnet' },
  { key: 'second', id: process.env.SECOND_ACCOUNT_ID || 'sentinel-second.testnet' },
];

async function exists(accountId) {
  try { await viewAccount(RPC, accountId); return true; } catch { return false; }
}

async function main() {
  let store = {};
  try { store = readKeystore(KEYDIR); } catch { /* first run */ }
  store.network = 'testnet';
  store.rpc = RPC;
  store.created_at = store.created_at || new Date().toISOString();
  store.accounts = store.accounts || {};

  for (const { key, id } of NAMES) {
    if (store.accounts[key]?.accountId === id && store.accounts[key]?.privateKey) {
      console.log(`==> ${id} already in keystore, skipping`);
      continue;
    }
    if (await exists(id)) {
      throw new Error(`${id} already exists on chain but its key is not in keys/testnet.json. ` +
        `Set ${key.toUpperCase()}_PRIVATE_KEY in the keystore or choose another name.`);
    }
    const kp = generateKeyPair();
    const res = await fetch(FAUCET, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'SentinelBody/0.1' },
      body: JSON.stringify({ newAccountId: id, newAccountPublicKey: kp.publicKey }),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`faucet HTTP ${res.status}: ${body.slice(0, 300)}`);
    console.log(`==> faucet accepted ${id} (${res.status})`);
    // Poll until the account is visible (faucet txs are optimistic at first).
    let ok = false;
    for (let i = 0; i < 20; i++) {
      if (await exists(id)) { ok = true; break; }
      await new Promise(r => setTimeout(r, 1000));
    }
    if (!ok) throw new Error(`account ${id} did not appear on chain: ${body.slice(0, 300)}`);
    const state = await viewAccount(RPC, id);
    console.log(`    verified on chain, balance ${(Number(state.amount) / 1e24).toFixed(3)} NEAR`);
    store.accounts[key] = {
      accountId: id, publicKey: kp.publicKey, privateKey: kp.privateKey,
      faucet_tx_status: JSON.parse(body).final_execution_status || 'submitted',
      balance_at_creation_yocto: state.amount,
    };
    writeKeystore(KEYDIR, store);
  }

  // Worker key for the Genesis agent runtime. It is added as a FUNCTION-CALL
  // key on agent-0.<contract> when Genesis is minted; its private half never
  // leaves keys/.
  if (!store.worker) {
    const kp = generateKeyPair();
    store.worker = { publicKey: kp.publicKey, privateKey: kp.privateKey, note: 'Genesis restricted publish_snapshot key' };
    writeKeystore(KEYDIR, store);
    console.log('==> generated Genesis worker key');
  }

  const deployment = {
    network: 'testnet',
    created_at: new Date().toISOString(),
    nft_contract_id: store.accounts.contract.accountId,
    admin_account_id: store.accounts.admin.accountId,
    genesis_worker_public_key: store.worker.publicKey,
    faucet: FAUCET,
    rpc: RPC,
    status: 'accounts_created',
    deployed_contract: null,
    genesis_agent_account: null,
    genesis_mint_tx: null,
    explorer: `https://testnet.nearblocks.io/accounts/${store.accounts.contract.accountId}`,
    note: 'Public metadata only. Private keys live in keys/testnet.json (gitignored).',
  };
  fs.writeFileSync(path.join(ROOT, 'deployments', 'testnet.json'), JSON.stringify(deployment, null, 2));
  console.log('==> wrote deployments/testnet.json');
  console.log(JSON.stringify(Object.fromEntries(Object.entries(store.accounts).map(([k, v]) => [k, v.accountId])), null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
