import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dbDir = path.join(root, 'src/lib/db');

const coreSrc = fs.readFileSync(path.join(dbDir, 'core.ts'), 'utf8');
const headerMatch = coreSrc.match(/^[\s\S]*?export class LocalDBCore \{/);
if (!headerMatch) throw new Error('LocalDBCore not found in core.ts');
const header = coreSrc.slice(0, headerMatch.index).trimEnd();

let coreBody = coreSrc
  .slice(headerMatch.index + 'export class LocalDBCore {'.length)
  .replace(/\n\}\s*$/, '');
coreBody = coreBody.replace(/^  protected /gm, '  private ');

const mixinFiles = [
  'mixins/storageMixin.ts',
  'mixins/socialMixin.ts',
  'mixins/premiumMixin.ts',
  'mixins/workspaceMixin.ts',
  'mixins/notificationsMixin.ts',
  'mixins/chatMixin.ts',
  'mixins/storiesMixin.ts',
  'mixins/commentsMixin.ts',
  'mixins/maintenanceMixin.ts',
];

function extractMixinBody(file) {
  const src = fs.readFileSync(path.join(dbDir, file), 'utf8');
  const start = src.indexOf('class extends Base {');
  if (start < 0) throw new Error(`No mixin body in ${file}`);
  let body = src.slice(start + 'class extends Base {'.length);
  const end = body.lastIndexOf('\n  };');
  if (end < 0) throw new Error(`No mixin end in ${file}`);
  body = body.slice(0, end);
  return body.replace(/^  protected /gm, '  private ');
}

const mixinBodies = mixinFiles.map(extractMixinBody).join('\n');

const monolith = `${header}

type Listener = () => void;
type CloudDataType = 'photos' | 'videos' | 'files' | 'messages' | 'stories' | 'posts';

class LocalDB {
${coreBody}
${mixinBodies}
}

export const db = new LocalDB();
`;

fs.writeFileSync(path.join(root, 'src/lib/db.ts'), monolith);
console.log('Restored src/lib/db.ts', monolith.split('\n').length, 'lines');
