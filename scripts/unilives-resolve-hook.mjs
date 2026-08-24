import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@unilives/')) {
    const name = specifier.slice('@unilives/'.length).split('/')[0];
    const pkgDir = join(ROOT, 'lib', `unilives-${name}`);
    const index = join(pkgDir, 'index.mjs');
    if (existsSync(index)) {
      return {
        shortCircuit: true,
        url: pathToFileURL(index).href,
      };
    }
  }
  return nextResolve(specifier, context);
}
