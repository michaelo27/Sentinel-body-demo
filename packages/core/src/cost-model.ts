/**
 * Builder Cost-of-Living Calculator — a PURE function used identically by the
 * runtime and the UI. No network calls, no hidden state. Every estimate is
 * labelled in `assumptions_used` so nothing is presented as fact if it isn't.
 *
 * NEAR is P0 and fully sourced from live RPC values. Base/Ethereum/Solana
 * comparison columns are P1 and carry explicit assumption labels.
 */
export interface Scenario {
  agents: number;
  txPerAgentDay: number;
  avgTgasPerTx: number;
  persistentStorageMB: number;
  inferenceTokensPerDay: number;
  model: string;
  infraUsdPerMonth: number;
}

export interface LiveParams {
  nearGasPriceYocto: string;   // from gas_price RPC
  storageByteCostYocto: string; // from EXPERIMENTAL_protocol_config
  nearUsd: number;
  ethUsd: number;
  solUsd: number;
  ethGasPriceWei: string;      // eth_gasPrice (hex -> decimal string)
  baseGasPriceWei: string;
  solRentLamports128b: number; // getMinimumBalanceForRentExemption
  solBaseFeeLamports: number;  // getFeeForMessage (measured)
  modelInputUsdPer1m: number;  // NEAR AI Cloud catalog
  modelOutputUsdPer1m: number;
}

export interface Assumptions {
  evmGasUnitsPerAction: number;
  solSignaturesPerAction: number;
  solAccountsPerAgent: number;
  inferenceInputSplit: number;
  utilization: number;
  nearStorageBytesPerAgent: number;
}

export const DEFAULT_SCENARIO: Scenario = {
  agents: 10, txPerAgentDay: 100, avgTgasPerTx: 0.3,
  persistentStorageMB: 1, inferenceTokensPerDay: 200_000,
  model: 'Qwen/Qwen3.8-27B', infraUsdPerMonth: 0,
};

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  evmGasUnitsPerAction: 120_000, solSignaturesPerAction: 1, solAccountsPerAgent: 1,
  inferenceInputSplit: 0.7, utilization: 0.8, nearStorageBytesPerAgent: 700,
};

export interface CostResult {
  actionsPerMonth: number;
  monthly: {
    gas_usd: number; storage_locked_near: number; storage_locked_usd: number;
    inference_usd: number; infra_usd: number; total_usd: number;
  };
  comparison: Array<{ chain: string; monthly_usd: number; assumptions: string[] }>;
  cost_per_1000_actions_usd: number;
  formulas: string[];
  assumptions_used: string[];
}

const YOCTO_PER_NEAR = 1e24;
const LAMPORTS_PER_SOL = 1e9;
const WEI_PER_ETH = 1e18;
const r = (n: number, d = 6) => Number(n.toFixed(d));

/** No hidden state: identical inputs always give an identical result. */
export function costModel(scenario: Scenario, live: LiveParams, assumptions: Assumptions = DEFAULT_ASSUMPTIONS): CostResult {
  const s = { ...DEFAULT_SCENARIO, ...scenario };
  const a = { ...DEFAULT_ASSUMPTIONS, ...assumptions };
  const days = 30;
  const actionsPerMonth = s.agents * s.txPerAgentDay * days * a.utilization;

  // --- NEAR gas: 1 Tgas = 1e12 gas units; gas_price is yoctoNEAR per unit.
  const gasUnitsPerAction = s.avgTgasPerTx * 1e12;
  const nearPerAction = (gasUnitsPerAction * Number(live.nearGasPriceYocto)) / YOCTO_PER_NEAR;
  const gasNearMonth = actionsPerMonth * nearPerAction;
  const gasUsd = gasNearMonth * live.nearUsd;

  // --- NEAR storage: LOCKED capital, not spent. Shown separately.
  const storageBytes = s.persistentStorageMB * 1e6;
  const storageLockedNear = (storageBytes * Number(live.storageByteCostYocto)) / YOCTO_PER_NEAR;
  const storageLockedUsd = storageLockedNear * live.nearUsd;

  // --- Inference: official NEAR AI Cloud per-1M-token prices, split is an assumption.
  const tokensMonth = s.inferenceTokensPerDay * days;
  const inferenceUsd =
    (tokensMonth / 1e6) *
    (a.inferenceInputSplit * live.modelInputUsdPer1m + (1 - a.inferenceInputSplit) * live.modelOutputUsdPer1m);

  const totalUsd = gasUsd + inferenceUsd + s.infraUsdPerMonth;

  // --- Comparison chains (P1). Gas prices are live; gas-units-per-action is an assumption.
  const evmCost = (wei: string, usd: number) =>
    actionsPerMonth * (a.evmGasUnitsPerAction * Number(wei)) / WEI_PER_ETH * usd + inferenceUsd + s.infraUsdPerMonth;
  const solPerActionSol = (a.solSignaturesPerAction * live.solBaseFeeLamports) / LAMPORTS_PER_SOL;
  const solRentSol = (s.agents * a.solAccountsPerAgent * live.solRentLamports128b) / LAMPORTS_PER_SOL;
  const solMonthlyUsd = actionsPerMonth * solPerActionSol * live.solUsd + inferenceUsd + s.infraUsdPerMonth;

  return {
    actionsPerMonth: r(actionsPerMonth, 2),
    monthly: {
      gas_usd: r(gasUsd), storage_locked_near: r(storageLockedNear),
      storage_locked_usd: r(storageLockedUsd), inference_usd: r(inferenceUsd),
      infra_usd: r(s.infraUsdPerMonth), total_usd: r(totalUsd),
    },
    comparison: [
      { chain: 'NEAR', monthly_usd: r(totalUsd), assumptions: ['gas price: source rate input', 'storage: reserved separately, not recurring', 'Tgas/tx: scenario input'] },
      { chain: 'Base', monthly_usd: r(evmCost(live.baseGasPriceWei, live.ethUsd)), assumptions: ['gasPrice: source rate input; excludes unmodelled L1 data / priority fees', 'gas units/action: ASSUMPTION', 'ETH price: dated provider input', 'same AI and hosting plan included'] },
      { chain: 'Ethereum', monthly_usd: r(evmCost(live.ethGasPriceWei, live.ethUsd)), assumptions: ['gasPrice: source rate input; excludes unmodelled L1 data / priority fees', 'gas units/action: ASSUMPTION', 'ETH price: dated provider input', 'same AI and hosting plan included'] },
      { chain: 'Solana', monthly_usd: r(solMonthlyUsd), assumptions: ['base fee: source getFeeForMessage input', `rent reserve excluded from recurring bill: ${r(solRentSol * live.solUsd)} USD`, 'signatures/action: ASSUMPTION', 'same AI and hosting plan included'] },
    ],
    cost_per_1000_actions_usd: r(actionsPerMonth > 0 ? totalUsd / (actionsPerMonth / 1000) : 0),
    formulas: [
      'actions/month = agents × tx/agent/day × 30 × utilization(assumption)',
      'NEAR gas NEAR/action = avgTgas × 10^12 × gas_price_yocto / 10^24',
      'NEAR gas USD/month = actions/month × gas NEAR/action × NEAR/USD',
      'storage LOCKED NEAR = MB × 10^6 × storage_amount_per_byte_yocto / 10^24 (locked capital, NOT spent)',
      'inference USD/month = tokens/day × 30 / 10^6 × (split × input_rate + (1−split) × output_rate)',
      'EVM USD/month = actions/month × gas_units(assumption) × gasPrice_wei / 10^18 × ETH/USD + same AI + hosting',
      'Solana USD/month = actions/month × sigs(assumption) × base_fee_lamports / 10^9 × SOL/USD + same AI + hosting (rent reserve excluded)',
      'cost per 1,000 actions = total spent USD/month ÷ (actions/month ÷ 1000)',
    ],
    assumptions_used: [
      `utilization ${a.utilization} (ASSUMPTION)`,
      `EVM gas units/action ${a.evmGasUnitsPerAction} (ASSUMPTION)`,
      `Solana signatures/action ${a.solSignaturesPerAction} (ASSUMPTION)`,
      `inference input/output split ${a.inferenceInputSplit} (ASSUMPTION)`,
      `scenario: ${s.agents} agents, ${s.txPerAgentDay} tx/day each (USER INPUT)`,
      `model ${s.model} priced from the official NEAR AI Cloud catalog (PUBLISHED)`,
    ],
  };
}
