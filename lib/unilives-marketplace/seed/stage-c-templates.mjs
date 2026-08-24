/** Stage C template manifests — no secrets, placeholder integrity over canonical JSON. */
import { createHash } from 'node:crypto';

const PLATFORM = '>=0.1.0';

function hashPayload(obj) {
  const canonical = JSON.stringify(obj);
  return {
    algorithm: 'sha256',
    hash: createHash('sha256').update(canonical).digest('hex'),
  };
}

function templateManifest(id, name, description, capabilities, metadata = {}) {
  const entrypoint = `./templates/${id}.mjs`;
  const body = {
    id: `unilives.template.${id}`,
    name,
    publisher: 'unilives',
    version: '0.1.0',
    type: 'template',
    description,
    capabilities,
    compatibility: { platform: PLATFORM, schemaVersion: 1 },
    entrypoint,
    permissions: [],
    metadata: { stage: 'C', ...metadata },
  };
  return { ...body, integrity: hashPayload({ ...body, entrypoint }) };
}

export const STAGE_C_TEMPLATE_MANIFESTS = [
  templateManifest('basic', 'Basic App', 'Single home page with heading and primary button', ['ui.render', 'navigation'], {
    tags: ['starter'],
  }),
  templateManifest('social', 'Social Feed', 'Feed and profile surfaces with realtime', ['ui.render', 'realtime.subscribe'], {
    tags: ['social'],
  }),
  templateManifest('reels', 'Reels', 'Vertical short-form video feed', ['ui.render', 'storage.read'], { tags: ['video'] }),
  templateManifest(
    'livestream',
    'Live Stream',
    'Broadcast stage with chat and gifts',
    ['ui.render', 'rtc.live', 'realtime.subscribe'],
    { tags: ['live'] },
  ),
  templateManifest('call', '1:1 Call', 'Voice and video call surface', ['ui.render', 'rtc.call'], { tags: ['call'] }),
  templateManifest(
    'marketplace',
    'Marketplace',
    'Catalog browse and checkout scaffold',
    ['ui.render', 'database.query'],
    { tags: ['commerce'] },
  ),
];
