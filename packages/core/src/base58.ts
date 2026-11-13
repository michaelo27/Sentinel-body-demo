/** Minimal base58 (Bitcoin alphabet) for NEAR public keys and block hashes. */
const A = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function b58encode(bytes: Uint8Array): string {
  let n = BigInt('0x' + Buffer.from(bytes).toString('hex'));
  let out = '';
  while (n > 0n) { out = A[Number(n % 58n)] + out; n /= 58n; }
  for (const b of bytes) { if (b === 0) out = '1' + out; else break; }
  return out;
}

export function b58decode(s: string): Buffer {
  let n = 0n;
  for (const c of s) {
    const i = A.indexOf(c);
    if (i < 0) throw new Error(`invalid base58 char ${c}`);
    n = n * 58n + BigInt(i);
  }
  let hex = n.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  const bytes = Buffer.from(hex, 'hex');
  const leading = [...s].findIndex((c) => c !== '1');
  return Buffer.concat([Buffer.alloc(leading < 0 ? s.length : leading), bytes]);
}
