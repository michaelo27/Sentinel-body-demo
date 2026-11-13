/**
 * Snapshot vault. Full snapshots are stored BEFORE the on-chain commitment is
 * attempted (brief: persist first, then commit). JSON files keep the demo
 * dependency-free; swapping in SQLite is a one-file change.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { SnapshotT } from '@sentinel/core';
import { DATA_DIR } from './config.js';

export type IndexEntry = {
  id: string; epoch_ts: string; content_hash: string; tx: string | null;
  mode: 'live' | 'replay'; stale: boolean; agent_account: string; methodology_version: string;
};

export class VaultStore {
  private idxPath: string;
  private dir: string;
  constructor(dir: string = DATA_DIR) {
    this.dir = dir;
    this.idxPath = path.join(dir, 'index.json');
    fs.mkdirSync(dir, { recursive: true });
  }

  private readIndex(): IndexEntry[] {
    if (!fs.existsSync(this.idxPath)) return [];
    try { return JSON.parse(fs.readFileSync(this.idxPath, 'utf8')); } catch { return []; }
  }
  private writeIndex(rows: IndexEntry[]) {
    fs.writeFileSync(this.idxPath, JSON.stringify(rows.slice(-500), null, 2));
  }

  save(s: SnapshotT): void {
    const hash = s.proof?.content_hash || '';
    fs.writeFileSync(path.join(this.dir, `${s.snapshot_id}.json`), JSON.stringify(s, null, 2));
    const rows = this.readIndex().filter((r) => r.id !== s.snapshot_id);
    rows.push({
      id: s.snapshot_id, epoch_ts: s.epoch_ts, content_hash: hash,
      tx: s.proof?.commitment_tx ?? null, mode: s.meta.mode,
      stale: s.meta.stale, agent_account: s.meta.agent_account,
      methodology_version: s.methodology_version,
    });
    rows.sort((a, b) => a.epoch_ts.localeCompare(b.epoch_ts));
    this.writeIndex(rows);
  }

  get(id: string): SnapshotT | null {
    const p = path.join(this.dir, `${path.basename(id)}.json`);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  }

  latest(): SnapshotT | null {
    const rows = this.readIndex();
    return rows.length ? this.get(rows[rows.length - 1]!.id) : null;
  }
  previous(): SnapshotT | null {
    const rows = this.readIndex();
    return rows.length > 1 ? this.get(rows[rows.length - 2]!.id) : null;
  }
  list(limit = 50): IndexEntry[] { return this.readIndex().slice(-limit).reverse(); }
  all(): SnapshotT[] { return this.readIndex().map((r) => this.get(r.id)).filter(Boolean) as SnapshotT[]; }
  count(): number { return this.readIndex().length; }

  /** Public tier: only snapshots older than the delay are eligible. */
  delayed(delayMinutes: number): SnapshotT | null {
    const cutoff = Date.now() - delayMinutes * 60_000;
    const eligible = this.readIndex().filter((r) => Date.parse(r.epoch_ts) <= cutoff);
    return eligible.length ? this.get(eligible[eligible.length - 1]!.id) : null;
  }

  isPublic(id: string, delayMinutes: number): boolean {
    const s = this.get(id);
    return !!s && Date.parse(s.epoch_ts) <= Date.now() - delayMinutes * 60_000;
  }
}

export const store = new VaultStore();
