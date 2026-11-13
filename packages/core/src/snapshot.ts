/** Assemble a complete, hashable snapshot from real inputs. */
import { canonicalize } from './canonical.js';
import { sha256Hex } from './hash-node.js';
import { costModel, DEFAULT_SCENARIO, DEFAULT_ASSUMPTIONS, type Scenario } from './cost-model.js';
import { capitalFlow, agentHealth, type CohortDef } from './indices.js';
import type { Inputs } from './fetchers.js';
import type { SnapshotT } from './schema.js';

export type BuildArgs = {
  inputs: Inputs;
  cohorts: CohortDef[];
  fleet: Parameters<typeof agentHealth>[0];
  previous?: SnapshotT | null;
  scenario?: Partial<Scenario>;
  mode?: 'live' | 'replay';
  runtimeVersion?: string;
  agentTokenId?: string;
  agentAccount?: string;
  methodologyVersion?: string;
  observedNetwork?: 'mainnet' | 'testnet';
};

export function buildSnapshot(args: BuildArgs): SnapshotT {
  const now = new Date();
  const epochTs = now.toISOString();
  const previousFleet = args.previous?.agent_health?.fleet
    ? { agents: args.previous.agent_health.fleet.agents, balance_near: args.previous.agent_health.fleet.balance_near }
    : null;
  const model = args.scenario?.model || DEFAULT_SCENARIO.model;
  const price = args.inputs.modelCatalog.find((m) => m.id === model) || args.inputs.modelCatalog[0] || { id: model, input: 0, output: 0 };
  const scenario = { ...DEFAULT_SCENARIO, ...args.scenario, model };

  const cost = costModel(scenario, {
    nearGasPriceYocto: args.inputs.gas.near_gas_price_yocto,
    storageByteCostYocto: args.inputs.gas.near_storage_byte_cost_yocto,
    nearUsd: args.inputs.prices.near_usd,
    ethUsd: args.inputs.prices.eth_usd,
    solUsd: args.inputs.prices.sol_usd,
    ethGasPriceWei: args.inputs.gas.eth_gas_price_wei,
    baseGasPriceWei: args.inputs.gas.base_gas_price_wei,
    solRentLamports128b: args.inputs.gas.sol_rent_lamports_128b,
    solBaseFeeLamports: args.inputs.gas.sol_base_fee_lamports,
    modelInputUsdPer1m: price.input,
    modelOutputUsdPer1m: price.output,
  }, DEFAULT_ASSUMPTIONS);

  const cf = capitalFlow(
    args.inputs, args.cohorts,
    args.previous ? { snapshot_id: args.previous.snapshot_id, params: args.previous.inputs.params } : null,
  );
  const health = agentHealth(args.fleet, previousFleet);

  const inputDigest = sha256Hex(canonicalize(args.inputs)).slice(0, 12);
  const snapshot_id = `snap-${Math.floor(now.getTime() / 1000)}-${inputDigest}`;

  const notes = [
    `Model ${price.id} priced from the official NEAR AI Cloud catalog (published, not an assumption).`,
    `NEAR gas price ${args.inputs.gas.near_gas_price_yocto} yocto/unit and storage ${args.inputs.gas.near_storage_byte_cost_yocto} yocto/byte are live RPC values.`,
    `Capital Flow method: ${cf.method}. Net, inferred flow — never gross transfers.`,
    `Health Index confidence ${health.confidence}; heuristic cohort is disabled (P1).`,
  ];
  if (args.inputs.stale) notes.push('STALE: at least one free source failed; values fell back to the last real snapshot.');
  if (args.mode === 'replay') notes.push('REPLAY: recorded real snapshot, not a new observation.');

  return {
    schema: 'sentinel.snapshot/1',
    snapshot_id, epoch_ts: epochTs,
    methodology_version: args.methodologyVersion || 'v1',
    observed_network: args.observedNetwork || 'mainnet',
    settled_network: 'testnet',
    inputs: {
      blocks: args.inputs.blocks,
      queries: args.inputs.queries,
      prices: args.inputs.prices,
      gas: args.inputs.gas,
      params: {
        ...args.inputs.params,
        cohort_balances: args.inputs.cohortBalances,
        model_catalog_digest: sha256Hex(canonicalize(args.inputs.modelCatalog)),
        validators: args.inputs.validators,
        cost_scenario: scenario,
        cost_assumptions: DEFAULT_ASSUMPTIONS,
      },
    },
    capital_flow: cf,
    cost_of_living: cost,
    agent_health: health,
    meta: {
      agent_token_id: args.agentTokenId || '0',
      agent_account: args.agentAccount || '',
      runtime_version: args.runtimeVersion || '0.1.0',
      mode: args.mode || 'live',
      stale: args.inputs.stale || args.fleet.stale,
      notes,
    },
  };
}
