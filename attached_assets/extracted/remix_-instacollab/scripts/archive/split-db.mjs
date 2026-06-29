/**
 * One-off splitter: db.ts → db/core + mixins. Re-run only if db.ts was restored monolithic.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const src = fs.readFileSync(path.join(root, 'src/lib/db.ts'), 'utf8');
const lines = src.split('\n');

const headerEnd = lines.findIndex((l) => l.startsWith('class LocalDB'));
const classEnd = lines.findIndex((l, i) => i > headerEnd && l === '}');
const header = lines.slice(0, headerEnd).join('\n');
const bodyLines = lines.slice(headerEnd + 1, classEnd);
const footer = lines.slice(classEnd + 1).join('\n');

const privToProtected = (chunk) =>
  chunk
    .replace(/^  private (save|load|cappedList|notifyListeners|trimHighChurnCollections|sanitizeMessageMedia|ensureMessageId|normalizeTimestampValue|backfillMessageTimestamps|scheduleAutoCloudSync|limitNewest|postSyncMessage|performStorageCleanup|performLightStorageCleanup|saveToIDB|retentionLimit|shouldSkipAutoRetention|ensureCurrentUserStorageTier|migrateGlobalMuteDefault|initIDB|refreshFromDB|get MAX_ITEMS|get MAX_SIZE)/gm, '  protected $1')
    .replace(/^  private /gm, '  protected ');

const slices = [
  { name: 'socialMixin', start: 0, end: 302 }, // through toggleReelSave ~line 1016 in file = index in body
];

// Map file line numbers (1-based) to body indices
const fileLineToBody = (line) => line - (headerEnd + 1) - 1;

const regions = [
  { file: 'core.ts', export: 'LocalDBCore', isCore: true, from: 89, to: 431 },
  { file: 'mixins/storageMixin.ts', export: 'StorageMixin', from: 433, to: 713 },
  { file: 'mixins/socialMixin.ts', export: 'SocialMixin', from: 716, to: 1223 },
  { file: 'mixins/premiumMixin.ts', export: 'PremiumMixin', from: 1224, to: 1797 },
  { file: 'mixins/workspaceMixin.ts', export: 'WorkspaceMixin', from: 1798, to: 1970 },
  { file: 'mixins/notificationsMixin.ts', export: 'NotificationsMixin', from: 1971, to: 2415 },
  { file: 'mixins/chatMixin.ts', export: 'ChatMixin', from: 2416, to: 2763 },
  { file: 'mixins/storiesMixin.ts', export: 'StoriesMixin', from: 2764, to: 3195 },
  { file: 'mixins/commentsMixin.ts', export: 'CommentsMixin', from: 3197, to: 3450 },
  { file: 'mixins/maintenanceMixin.ts', export: 'MaintenanceMixin', from: 3452, to: 3610 },
];

const dbDir = path.join(root, 'src/lib/db');
fs.mkdirSync(path.join(dbDir, 'mixins'), { recursive: true });

for (const region of regions) {
  const start = fileLineToBody(region.from);
  const end = fileLineToBody(region.to);
  const chunk = privToProtected(bodyLines.slice(start, end + 1).join('\n'));

  if (region.isCore) {
    const coreContent = `${header}

type Listener = () => void;
type CloudDataType = 'photos' | 'videos' | 'files' | 'messages' | 'stories' | 'posts';

export class LocalDBCore {
${chunk}
}
`;
    fs.writeFileSync(path.join(dbDir, region.file), coreContent);
    continue;
  }

  const mixinContent = `${header}

import type { Constructor } from '../types';
import { LocalDBCore } from '../core';

export const ${region.export} = <TBase extends Constructor<LocalDBCore>>(Base: TBase) =>
  class extends Base {
${chunk}
  };
`;
  fs.writeFileSync(path.join(dbDir, region.file), mixinContent);
}

const indexContent = `${header}

import { LocalDBCore } from './core';
import type { Constructor } from './types';
import { StorageMixin } from './mixins/storageMixin';
import { SocialMixin } from './mixins/socialMixin';
import { PremiumMixin } from './mixins/premiumMixin';
import { WorkspaceMixin } from './mixins/workspaceMixin';
import { NotificationsMixin } from './mixins/notificationsMixin';
import { ChatMixin } from './mixins/chatMixin';
import { StoriesMixin } from './mixins/storiesMixin';
import { CommentsMixin } from './mixins/commentsMixin';
import { MaintenanceMixin } from './mixins/maintenanceMixin';

type AnyConstructor = new (...args: unknown[]) => object;

function composeDatabase<T extends AnyConstructor>(
  Base: T,
  ...mixins: Array<(base: AnyConstructor) => AnyConstructor>
) {
  return mixins.reduce(
    (acc, mixin) => mixin(acc) as T,
    Base
  ) as T;
}

const LocalDB = composeDatabase(
  LocalDBCore,
  StorageMixin,
  SocialMixin,
  PremiumMixin,
  WorkspaceMixin,
  NotificationsMixin,
  ChatMixin,
  StoriesMixin,
  CommentsMixin,
  MaintenanceMixin,
);

${footer}
`;

fs.writeFileSync(path.join(dbDir, 'index.ts'), indexContent);
fs.writeFileSync(path.join(dbDir, 'types.ts'), `import type { LocalDBCore } from './core';

export type Constructor<T> = new (...args: unknown[]) => T;

export type LocalDBInstance = InstanceType<typeof import('./index').LocalDB>;
`);

// Replace db.ts with re-export
fs.writeFileSync(
  path.join(root, 'src/lib/db.ts'),
  `/** @deprecated Import from './db/index' — thin re-export for existing paths. */
export { db } from './db/index';
export type { LocalDBCore } from './db/core';
`,
);

console.log('Split complete. Run npm run lint');
