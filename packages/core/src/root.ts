/** Resolve the monorepo root in both ESM and tsx/CJS execution contexts. */
import fs from 'node:fs';
import path from 'node:path';

export const ROOT: string = (() => {
  let d = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (fs.existsSync(path.join(d, 'config/rpc.json'))) return d;
    d = path.dirname(d);
  }
  const here = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
  for (let i = 0; i < 5; i++) {
    const c = path.resolve(here, ...Array(i).fill('..'));
    if (fs.existsSync(path.join(c, 'config/rpc.json'))) return c;
  }
  return process.cwd();
})();
