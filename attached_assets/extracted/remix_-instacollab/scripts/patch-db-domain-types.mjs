#!/usr/bin/env node
/** Patches domain mixin signatures and removes @ts-nocheck. Run once after split. */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const domainsDir = path.join(root, 'src/lib/db/domains');

const LAYER_NAMES = {
  authPosts: 'AuthPosts',
  followBlocked: 'FollowBlocked',
  profile: 'Profile',
  workspaceTasks: 'WorkspaceTasks',
  reels: 'Reels',
  notifications: 'Notifications',
  workspaceFiles: 'WorkspaceFiles',
  messages: 'Messages',
  stories: 'Stories',
  settings: 'Settings',
  cloud: 'Cloud',
  uiFlags: 'UiFlags',
  comments: 'Comments',
};

for (const file of fs.readdirSync(domainsDir)) {
  if (!file.endsWith('.ts')) continue;
  const key = file.replace('.ts', '');
  const layer = LAYER_NAMES[key];
  if (!layer) continue;

  const filePath = path.join(domainsDir, file);
  let src = fs.readFileSync(filePath, 'utf8');

  src = src.replace(/^\/\/ @ts-nocheck[^\n]*\n/, '');

  src = src.replace(
    /export function (With\w+)<T extends Constructor<DbCore>>\(Base: T\) \{\n  return class extends Base \{\n    constructor\(\.\.\.args: any\[\]\) \{\n      super\(\.\.\.args\);\n    \}/,
    `export function $1<T extends Constructor>(Base: T): MixinCtor<T, ${layer}Layer> {\n  return class extends Base {\n    constructor(...args: unknown[]) {\n      super(...args);\n    }`
  );

  if (!src.includes(`MixinCtor<T, ${layer}Layer>`)) {
    src = src.replace(
      /export function (With\w+)<T extends Constructor<DbCore>>\(Base: T\) \{/,
      `export function $1<T extends Constructor>(Base: T): MixinCtor<T, ${layer}Layer> {`
    );
    src = src.replace(/constructor\(\.\.\.args: any\[\]\)/, 'constructor(...args: unknown[])');
  }

  src = src.replace(/\n  \};\n\}\s*$/, `\n  } as MixinCtor<T, ${layer}Layer>;\n}\n`);

  if (!src.includes("from '../mixin'") || !src.includes('MixinCtor')) {
    src = src.replace(
      /import type \{ Constructor \} from '\.\.\/mixin';/,
      "import type { Constructor, MixinCtor } from '../mixin';"
    );
  }
  src = src.replace(/import type \{ DbCore \} from '\.\.\/dbCore';\n\n?/g, '');

  fs.writeFileSync(filePath, src);
  console.log('Patched', file);
}
