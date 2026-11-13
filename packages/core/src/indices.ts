/**
 * Three intelligence layers. Fixed normalization bounds live in
 * config/methodology.v1.json and are NEVER data-adaptive, so a number stays
 * reproducible. Low evidence lowers CONFIDENCE, it does not silently produce
 * an authoritative-looking score.
 */
import type { Inputs } from './fetchers.js';

export const METHODOLOGY_NOT_A = 'Not a price signal, not an investment metric, not a census of all agents, and not ground truth about account identity. It is a bounded, labelled measurement of our own agent fleet plus verified cohort balances.';

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const r = (n: number, d = 6) => Number(n.toFixed(d));

const WNEAR_DECIMALS = 24;
const USDC_DECIMALS = 6;
const NEAR_DECIMALS = 24;

export type CohortDef = { id: string; label: string; category: string; accounts: string[]; assets: string[]; confidence?: string };

export function capitalFlow(
  inputs: Inputs,
  cohorts: CohortDef[],
  previous?: { snapshot_id: string; params: Record<string, unknown> } | null,
) {
  const now = new Map(inputs.cohortBalances.map((b) => [b.account, b]));
  const prevRows = (previous?.params?.cohort_balances as Array<Record<string, string>> | undefined) || [];
  const prev = new Map(prevRows.map((b) => [String(b.account), b]));
  const method = previous
    ? 'snapshot_diff_24h (agent\'s own previous real snapshot; no archival node needed)'
    : 'pinned_block_delta_12h (verified RPC archival window; garbage-collected beyond ~86,400 blocks)';
  const pinnedHeight = Object.entries(inputs.blocks).find(([k]) => k.endsWith('.pinned_12h'))?.[1] ?? 0;
  const reference = previous ? `snapshot:${previous.snapshot_id}` : `block:${pinnedHeight}`;

  const out = cohorts.map((c) => {
    let netNear = 0;
    let netUsdc = 0;
    const assets: Record<string, number> = {};
    for (const account of c.accounts) {
      const cur = now.get(account);
      if (!cur || !cur.near_ok) continue;
      const old = prev.get(account);
      const base = previous && old?.near_yocto
        ? Number(old.near_yocto)
        : (cur.near_yocto_pinned ? Number(cur.near_yocto_pinned) : Number(cur.near_yocto));
      const dNear = (Number(cur.near_yocto) - base) / 10 ** NEAR_DECIMALS;
      netNear += dNear;
      assets.NEAR = r((assets.NEAR || 0) + dNear, 8);

      if (c.assets.includes('wNEAR') && cur.ft_ok) {
        const baseW = previous && old?.wnear_raw ? Number(old.wnear_raw) : Number(cur.wnear_raw);
        const dW = (Number(cur.wnear_raw) - baseW) / 10 ** WNEAR_DECIMALS;
        netNear += dW;
        assets.wNEAR = r((assets.wNEAR || 0) + dW, 8);
      }
      if (c.assets.includes('USDC')) {
        const baseU = previous && old?.usdc_raw ? Number(old.usdc_raw) : Number(cur.usdc_raw);
        const dU = (Number(cur.usdc_raw) - baseU) / 10 ** USDC_DECIMALS;
        netUsdc += dU;
        assets.USDC = r((assets.USDC || 0) + dU, 6);
      }
    }
    return {
      id: c.id, label: c.label, category: c.category,
      net_near: r(netNear, 8),
      net_usd: r(netNear * inputs.prices.near_usd + netUsdc, 4),
      assets,
      confidence: previous ? 'measured: snapshot balance delta' : 'measured: pinned-block balance delta',
    };
  });

  return {
    method,
    window_hours: previous ? 24 : 12,
    reference,
    cohorts: out,
    total_net_near: r(out.reduce((s, c) => s + c.net_near, 0), 8),
    total_net_usd: r(out.reduce((s, c) => s + c.net_usd, 0), 4),
    confidence: previous ? 'measured' : 'first_round_baseline_pin',
  };
}

const BOUNDS: Record<string, { low: number; high: number; weight: number }> = {
  activity: { low: 0, high: 25, weight: 0.20 },
  growth: { low: -0.25, high: 0.25, weight: 0.15 },
  capital: { low: -0.30, high: 0.30, weight: 0.20 },
  concentration: { low: 0, high: 1, weight: 0.15 },
  retention: { low: 0, high: 1, weight: 0.15 },
  fleet_liveness: { low: 0, high: 1, weight: 0.15 },
};

export function agentHealth(
  fleet: { supply: number; agents: Array<{ token_id: string; account: string; balance_near: number; keys: any[]; owner: string }>; commits: any[]; stale: boolean },
  previousFleet?: { agents: number; balance_near: number } | null,
) {
  const n = fleet.agents.length;
  const balances = fleet.agents.map((a) => a.balance_near);
  const totalBalance = balances.reduce((s, b) => s + b, 0);
  // "active" = published at least once among the newest two rounds (real on-chain commitments).
  const recent = fleet.commits.slice(-2);
  const publishers = new Set(recent.map((c) => c.agent_account));
  const active = fleet.agents.filter((a) => publishers.has(a.account)).length;

  const growthRaw = previousFleet && previousFleet.agents > 0
    ? (n - previousFleet.agents) / previousFleet.agents : 0;
  const capitalRaw = previousFleet && previousFleet.balance_near > 0
    ? (totalBalance - previousFleet.balance_near) / previousFleet.balance_near : 0;
  const hhi = totalBalance > 0 ? balances.reduce((s, b) => s + (b / totalBalance) ** 2, 0) : 1;
  const concentrationRaw = 1 - hhi; // lower concentration = healthier
  const retentionRaw = n > 0 ? active / n : 0;

  const raws: Record<string, number> = {
    activity: active, growth: growthRaw, capital: capitalRaw,
    concentration: concentrationRaw, retention: retentionRaw, fleet_liveness: retentionRaw,
  };
  const components = Object.entries(BOUNDS).map(([id, b]) => ({
    id, raw: r(raws[id]!, 6),
    normalized: r(clamp01((raws[id]! - b.low) / (b.high - b.low)) * 100, 2),
    weight: b.weight,
    confidence: id === 'activity' ? 'measured (fleet only; heuristic cohort disabled P1)' : 'measured',
  }));
  const score = r(components.reduce((s, c) => s + c.normalized * c.weight, 0), 2);
  // Coverage: how much of the intended evidence base is actually observed.
  const coverage = r(clamp01(
    (n > 0 ? 0.6 : 0) + (fleet.commits.length > 0 ? 0.2 : 0) + (previousFleet ? 0.2 : 0),
  ), 2);
  const confidence = r(coverage * (fleet.stale ? 0.6 : 1), 2);

  return {
    score, confidence, coverage, components,
    cohorts: [
      { id: 'fleet', confidence: 'measured', accounts: n, status: 'primary (fully real, testnet)' },
      { id: 'known', confidence: 'known', accounts: 0, status: 'empty: no verified registry' },
      { id: 'heuristic', confidence: 'heuristic', accounts: 0, status: 'disabled P1' },
    ],
    fleet: {
      agents: n, active, balance_near: r(totalBalance, 4), publishes: fleet.commits.length,
    },
    what_this_is_not: METHODOLOGY_NOT_A,
  };
}
