#!/usr/bin/env node
/**
 * test:creator-keyboard — all 6 Creator input-bearing source groups on keyboard SSOT.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const app = path.join(root, 'artifacts/instacollab');

const CREATOR_FILES = [
  'src/components/layout/ShellCreateCaptionPanel.tsx',
  'src/components/stories/StoryCaptionComposer.tsx',
  'src/components/karaoke/SongUpload.tsx',
  'src/components/launch/OnboardingBackgroundUpload.tsx',
  'src/components/profile-setup/brand/UniLivesAvatarUploader.tsx',
  'src/components/stories/StoryCreatorFlow.tsx',
];

const SSOT_RE =
  /keyboardInputClassName|keyboardLayout|keyboardSurfaceDataAttr|data-keyboard-ssot|pb-composer/;

for (const rel of CREATOR_FILES) {
  const full = path.join(app, rel);
  assert.ok(fs.existsSync(full), `missing ${rel}`);
  const src = fs.readFileSync(full, 'utf8');
  assert.match(src, SSOT_RE, `${rel} must use keyboard SSOT`);
  console.log(`PASS ${path.basename(rel)}`);
}

console.log('\ncreator-keyboard 6/6 SSOT migration PASS');
