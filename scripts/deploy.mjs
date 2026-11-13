/**
 * Deploy Sentinel Body to NEAR testnet and mint Sentinel #0 (Genesis).
 *
 * Prerequisites: `pnpm build:contracts` and `node scripts/create-account.mjs`.
 * Everything here is a REAL transaction on testnet; the resulting tx hashes and
 * account IDs are written to deployments/testnet.json (no private keys).
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  A, NEAR, readKeystore, signAndSend, viewAccount, viewAccessKeyList, viewFunction,
} from './near-tx.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const URLS = ['https://test.rpc.fastnear.com', 'https://near-testnet.drpc.org'];
const RPC = URLS[0];
const WASM = path.join(ROOT, 'target/near/sentinel-body.wasm');
const DEPLOYMENT = path.join(ROOT, 'deployments/testnet.json');
const GATEWAY_BASE = process.env.GATEWAY_PUBLIC_URL || 'http://localhost:8787';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function waitFor(label, fn, tries = 30) {
  for (let i = 0; i < tries; i++) {
    try { const v = await fn(); if (v) return v; } catch { /* not ready */ }
    await sleep(1500);
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function send(label, opts) {
  const r = await signAndSend({ urls: URLS, ...opts });
  console.log(`    ${label}: ${r.success ? 'OK' : 'FAILED'} ${r.txHash}`);
  if (!r.success) throw new Error(`${label} tx failed: ${JSON.stringify(r.failure)}`);
  return r;
}

async function main() {
  const store = readKeystore(path.join(ROOT, 'keys'));
  const contract = store.accounts.contract;
  const admin = store.accounts.admin;
  const worker = store.worker;
  const contractId = contract.accountId;
  if (!fs.existsSync(WASM)) throw new Error(`missing ${WASM}; run pnpm build:contracts`);
  const wasm = fs.readFileSync(WASM);
  const dep = JSON.parse(fs.readFileSync(DEPLOYMENT, 'utf8'));

  console.log(`==> contract account ${contractId}, admin ${admin.accountId}`);
  console.log(`    NFT wasm ${wasm.length} bytes`);

  // The 473 KB NFT wasm locks ~4.7 NEAR of storage on the contract account.
  // The faucet only seeds 10 NEAR, so top it up from the admin account (free
  // testnet tokens) to leave room for Genesis + judge mints.
  let bal = BigInt((await viewAccount(RPC, contractId)).amount);
  if (bal < 8n * NEAR) {
    console.log(`==> topping up contract (balance ${Number(bal) / 1e24} NEAR)`);
    await send('top-up', {
      signerId: admin.accountId, privateKey: admin.privateKey, publicKey: admin.publicKey,
      receiverId: contractId, actions: [A.transfer(4n * NEAR)],
    });
    await waitFor('top-up', async () => BigInt((await viewAccount(RPC, contractId)).amount) > bal);
  }

  const alreadyDeployed = await viewFunction(RPC, contractId, 'config').catch(() => null);
  let deployTx = null;
  if (alreadyDeployed?.contract_id) {
    console.log('==> contract already initialized, skipping deploy');
  } else {
    console.log('==> deploying + initializing NFT contract');
    deployTx = await send('deploy+new', {
      signerId: contractId, privateKey: contract.privateKey, publicKey: contract.publicKey,
      receiverId: contractId,
      actions: [
        A.deployContract(wasm),
        A.functionCall('new', {
          admin: admin.accountId,
          default_worker_key: worker.publicKey,
          gateway_base: GATEWAY_BASE,
          min_publish_interval_seconds: Number(process.env.MIN_PUBLISH_INTERVAL_SECONDS || 20),
        }, 150, 0n),
      ],
    });
  }

  const cfg = await waitFor('config()', async () => {
    const c = await viewFunction(RPC, contractId, 'config').catch(() => null);
    return c?.contract_id ? c : null;
  });
  console.log('==> config:', JSON.stringify(cfg, null, 2).slice(0, 900));
  const mintCost = BigInt(cfg.mint_cost_yocto);
  console.log(`    mint_cost = ${Number(mintCost) / 1e24} NEAR (testnet tokens, free)`);

  const genesis = await viewFunction(RPC, contractId, 'nft_token', { token_id: '0' }).catch(() => null);
  let genesisTx = null;
  if (genesis) {
    console.log('==> Genesis already minted');
  } else {
    console.log('==> minting Sentinel #0 (Genesis) — provisioning agent account');
    genesisTx = await send('mint_genesis', {
      signerId: admin.accountId, privateKey: admin.privateKey, publicKey: admin.publicKey,
      receiverId: contractId,
      actions: [A.functionCall('mint_genesis', {}, 300, mintCost + NEAR / 10n)],
    });
  }

  const token = await waitFor('Genesis NFT', () => viewFunction(RPC, contractId, 'nft_token', { token_id: '0' }));
  const agentId = await viewFunction(RPC, contractId, 'agent_account_of', { token_id: '0' });
  if (!agentId) throw new Error('Genesis agent account not registered');
  console.log(`==> Genesis agent: ${agentId}`);

  const keys = await waitFor('agent keys', () => viewAccessKeyList(RPC, agentId));
  console.log('==> agent access keys:', JSON.stringify(keys.keys, null, 2).slice(0, 900));
  const fullAccess = keys.keys.filter(k => k.access_key.permission === 'FullAccess');
  if (fullAccess.length) throw new Error('SECURITY: agent account has a full-access key');
  if (keys.keys.length !== 1) throw new Error(`expected exactly 1 key, got ${keys.keys.length}`);
  const agentState = await viewAccount(RPC, agentId);
  console.log(`    agent balance ${(Number(agentState.amount) / 1e24).toFixed(3)} NEAR, storage ${agentState.storage_usage} bytes`);

  Object.assign(dep, {
    status: 'deployed_and_genesis_minted',
    deployed_at: new Date().toISOString(),
    deployed_contract: {
      account_id: contractId,
      wasm_bytes: wasm.length,
      deploy_tx: deployTx?.txHash || dep.deployed_contract?.deploy_tx || null,
      admin_account_id: admin.accountId,
      config: cfg,
      explorer: `https://testnet.nearblocks.io/accounts/${contractId}`,
    },
    genesis_agent_account: agentId,
    genesis_token_id: '0',
    genesis_owner: admin.accountId,
    genesis_mint_tx: genesisTx?.txHash || dep.genesis_mint_tx || null,
    genesis_access_keys: keys.keys,
    genesis_agent_balance_yocto: agentState.amount,
    gateway_url: GATEWAY_BASE,
    near_sdk: '5.30.1',
    note: 'All values above were read back from testnet RPC view calls after the transactions. Private keys live in keys/testnet.json (gitignored).',
  });
  fs.writeFileSync(DEPLOYMENT, JSON.stringify(dep, null, 2) + '\n');
  console.log('==> wrote deployments/testnet.json');
  console.log('\nDONE. Next: pnpm agent:run (publishes a real snapshot) then pnpm gateway + pnpm web.');
}

main().catch(e => { console.error(e); process.exit(1); });
