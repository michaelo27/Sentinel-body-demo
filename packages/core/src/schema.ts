/** Snapshot schema — the single source of truth for the vault payload. */
import { z } from 'zod';

export const QueryRecord = z.object({
  id: z.string(),
  url: z.string(),
  method: z.string(),
  params: z.unknown(),
  response_digest: z.string(),
  block_height: z.number().int().nonnegative().optional(),
  status: z.enum(['ok', 'stale', 'failed']).default('ok'),
  note: z.string().optional(),
});

export const Snapshot = z.object({
  schema: z.literal('sentinel.snapshot/1'),
  snapshot_id: z.string(),
  epoch_ts: z.string(),
  methodology_version: z.string(),
  observed_network: z.enum(['mainnet', 'testnet']),
  settled_network: z.literal('testnet'),
  inputs: z.object({
    blocks: z.record(z.string(), z.number().int().nonnegative()),
    queries: z.array(QueryRecord),
    prices: z.object({
      near_usd: z.number(), eth_usd: z.number(), sol_usd: z.number(),
      price_source: z.string(), price_observed_at: z.number(),
    }),
    gas: z.object({
      near_gas_price_yocto: z.string(),
      near_storage_byte_cost_yocto: z.string(),
      near_min_gas_price_yocto: z.string().optional(),
      eth_gas_price_wei: z.string(),
      base_gas_price_wei: z.string(),
      sol_rent_lamports_128b: z.number(),
      sol_base_fee_lamports: z.number(),
    }),
    params: z.record(z.string(), z.unknown()),
  }),
  capital_flow: z.object({
    method: z.string(),
    window_hours: z.number(),
    reference: z.string(),
    cohorts: z.array(z.object({
      id: z.string(), label: z.string(), category: z.string(),
      net_near: z.number(), net_usd: z.number(),
      assets: z.record(z.string(), z.number()),
      confidence: z.string(),
    })),
    total_net_near: z.number(),
    total_net_usd: z.number(),
    confidence: z.string(),
  }),
  cost_of_living: z.object({
    scenario: z.record(z.string(), z.unknown()),
    monthly: z.object({
      gas_usd: z.number(), storage_locked_near: z.number(), storage_locked_usd: z.number(),
      inference_usd: z.number(), infra_usd: z.number(), total_usd: z.number(),
    }),
    comparison: z.array(z.object({
      chain: z.string(), monthly_usd: z.number(), assumptions: z.array(z.string()),
    })),
    cost_per_1000_actions_usd: z.number(),
    formulas: z.array(z.string()),
    assumptions_used: z.array(z.string()),
  }),
  agent_health: z.object({
    score: z.number(), confidence: z.number(), coverage: z.number(),
    components: z.array(z.object({ id: z.string(), raw: z.number(), normalized: z.number(), weight: z.number(), confidence: z.string() })),
    cohorts: z.array(z.object({ id: z.string(), confidence: z.string(), accounts: z.number(), status: z.string() })),
    fleet: z.object({ agents: z.number(), active: z.number(), balance_near: z.number(), publishes: z.number() }),
    what_this_is_not: z.string(),
  }),
  meta: z.object({
    agent_token_id: z.string(),
    agent_account: z.string(),
    runtime_version: z.string(),
    mode: z.enum(['live', 'replay']),
    stale: z.boolean(),
    notes: z.array(z.string()),
  }),
  // Off-chain only. NEVER included in the content hash (see canonical.ts).
  proof: z.object({
    content_hash: z.string().optional(),
    commitment_tx: z.string().nullable().optional(),
    commitment_status: z.enum(['pending', 'confirmed', 'unavailable']).optional(),
    publisher_account: z.string().optional(),
    explorer_url: z.string().optional(),
  }).optional(),
});

export type SnapshotT = z.infer<typeof Snapshot>;
export type QueryRecordT = z.infer<typeof QueryRecord>;
