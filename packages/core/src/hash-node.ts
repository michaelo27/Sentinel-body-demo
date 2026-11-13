/** Node/CLI side of the shared hashing (server-side only). */
import { createHash } from 'node:crypto';
import { canonicalize, hashable } from './canonical.js';

export function sha256Hex(input: string | Uint8Array): string {
  return createHash('sha256').update(input).digest('hex');
}

export function hashSnapshot(snapshot: unknown): string {
  return sha256Hex(canonicalize(hashable(snapshot)));
}
