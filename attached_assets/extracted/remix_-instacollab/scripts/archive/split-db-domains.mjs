#!/usr/bin/env node
/**
 * One-shot extractor: splits src/lib/db.ts into mixin domain modules under src/lib/db/.
 * Run from repo root: node scripts/split-db-domains.mjs
 * Requires src/lib/db.monolith.ts backup — run once before replacing db.ts.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const monolithPath = path.join(root, 'src/lib/db.monolith.ts');
const srcPath = path.join(root, 'src/lib/db.ts');
const outDir = path.join(root, 'src/lib/db');

if (!fs.existsSync(monolithPath)) {
  console.error('Missing src/lib/db.monolith.ts — restore monolith before re-running.');
  process.exit(1);
}

const source = fs.readFileSync(monolithPath, 'utf8');
const lines = source.split('\n');

const headerEnd = lines.findIndex((l) => l.startsWith('class LocalDB'));
const headerLines = lines
  .slice(0, headerEnd)
  .filter((l) => !l.startsWith('type Listener =') && !l.startsWith('type CloudDataType ='));

/** 1-based inclusive line ranges (method bodies inside class). */
const SLICES = [
  { file: 'domains/authPosts.ts', exportName: 'WithAuthPosts', start: 611, end: 910 },
  { file: 'domains/followBlocked.ts', exportName: 'WithFollowBlocked', start: 912, end: 1118 },
  { file: 'domains/profile.ts', exportName: 'WithProfile', start: 1120, end: 1693 },
  { file: 'domains/workspaceTasks.ts', exportName: 'WithWorkspaceTasks', start: 1694, end: 1810 },
  { file: 'domains/reels.ts', exportName: 'WithReels', start: 1812, end: 1868 },
  { file: 'domains/notifications.ts', exportName: 'WithNotifications', start: 1871, end: 2289 },
  { file: 'domains/workspaceFiles.ts', exportName: 'WithWorkspaceFiles', start: 2291, end: 2315 },
  { file: 'domains/messages.ts', exportName: 'WithMessages', start: 2318, end: 2667 },
  { file: 'domains/stories.ts', exportName: 'WithStories', start: 2668, end: 2792 },
  { file: 'domains/settings.ts', exportName: 'WithSettings', start: 2793, end: 2866 },
  { file: 'domains/cloud.ts', exportName: 'WithCloud', start: 2868, end: 3100 },
  { file: 'domains/uiFlags.ts', exportName: 'WithUiFlags', start: 3102, end: 3125 },
  { file: 'domains/comments.ts', exportName: 'WithComments', start: 3126, end: 3356 },
];

const CORE_START = 96;
const CORE_END = 609;
const CORE_TAIL_START = 3358;
const CORE_TAIL_END = 3448;

function sliceBody(start, end) {
  return lines.slice(start - 1, end).join('\n');
}

function indentClassBody(body) {
  return body
    .split('\n')
    .map((l) => (l.length ? `  ${l}` : l))
    .join('\n');
}

/** Monolith imports use ./ and ../ — rewrite for db/ or db/domains/ depth. */
function rewriteImports(text, depth) {
  const prefix = depth === 2 ? '../../' : '../';
  return text
    .replace(/from '\.\//g, `from '${prefix}`)
    .replace(/from "\.\//g, `from "${prefix}`)
    .replace(/from '\.\.\/types'/g, `from '${depth === 2 ? '../../../' : '../../'}types'`)
    .replace(/from "\.\.\/types"/g, `from "${depth === 2 ? '../../../' : '../../'}types"`)
    .replace(/from '\.\.\/components\//g, `from '${depth === 2 ? '../../../' : '../../'}components/`);
}

function relImportPath(fromFile, target) {
  const fromDir = path.dirname(fromFile);
  let rel = path.relative(fromDir, path.join(outDir, target)).replaceAll('\\', '/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  return rel.replace(/\.ts$/, '');
}

fs.mkdirSync(path.join(outDir, 'domains'), { recursive: true });

fs.writeFileSync(
  path.join(outDir, 'types.ts'),
  `export type Listener = () => void;
export type CloudDataType = 'photos' | 'videos' | 'files' | 'messages' | 'stories' | 'posts';
`
);

fs.writeFileSync(
  path.join(outDir, 'mixin.ts'),
  `export type Constructor<T = object> = new (...args: unknown[]) => T;
`
);

const coreBody =
  sliceBody(CORE_START, CORE_END) + '\n\n' + sliceBody(CORE_TAIL_START, CORE_TAIL_END);

const dbCoreImports = `${rewriteImports(headerLines.join('\n'), 1)}
import type { Listener } from './types';
`;

fs.writeFileSync(
  path.join(outDir, 'dbCore.ts'),
  `${dbCoreImports}

export class DbCore {
${indentClassBody(coreBody)}
}
`
);
console.log('Wrote dbCore.ts');

for (const slice of SLICES) {
  const body = sliceBody(slice.start, slice.end);
  const mixinImports = `${rewriteImports(headerLines.join('\n'), 2)}
import type { Constructor } from '../mixin';
import type { DbCore } from '../dbCore';

export function ${slice.exportName}<T extends Constructor<DbCore>>(Base: T) {
  return class extends Base {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      super(...args);
    }
${indentClassBody(body)}
  };
}
`;
  const fullPath = path.join(outDir, slice.file);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, mixinImports);
  console.log(`Wrote ${slice.file}`);
}

const composeOrder = [
  'WithAuthPosts',
  'WithFollowBlocked',
  'WithProfile',
  'WithWorkspaceTasks',
  'WithReels',
  'WithNotifications',
  'WithWorkspaceFiles',
  'WithMessages',
  'WithStories',
  'WithSettings',
  'WithCloud',
  'WithComments',
  'WithUiFlags',
];

const domainImports = composeOrder
  .map((name) => {
    const slice = SLICES.find((s) => s.exportName === name);
    return `import { ${name} } from './domains/${path.basename(slice.file, '.ts')}';`;
  })
  .join('\n');

const composeChain = composeOrder.reduce((acc, name) => `${name}(${acc})`, 'DbCore');

fs.writeFileSync(
  path.join(outDir, 'localDb.ts'),
  `${rewriteImports(headerLines.join('\n'), 1)}
import { DbCore } from './dbCore';
${domainImports}

function composeLocalDB() {
  return ${composeChain};
}

export class LocalDB extends composeLocalDB() {}

export const db = new LocalDB();
`
);
console.log('Wrote localDb.ts');

fs.writeFileSync(
  path.join(root, 'src/lib/db.ts'),
  `export { db, LocalDB } from './db/localDb';
export type { Listener, CloudDataType } from './db/types';
`
);
console.log('Replaced src/lib/db.ts with barrel');
