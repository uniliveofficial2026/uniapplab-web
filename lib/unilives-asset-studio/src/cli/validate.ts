#!/usr/bin/env tsx
import { loadEnvLocal } from '../config/env.js';
import { validateManifest } from '../validation/validateManifest.js';
import { validateOutputs } from '../validation/validateOutputs.js';
import { validateReferences } from '../validation/validateReferences.js';
import { validateSecrets } from '../validation/validateSecrets.js';

loadEnvLocal();
const results = [
  ['secrets', validateSecrets()],
  ['manifest', validateManifest()],
  ['outputs', validateOutputs()],
  ['references', validateReferences()],
] as const;

let ok = true;
for (const [name, r] of results) {
  console.log(`${name}: ${r.ok ? 'ok' : 'FAIL'}`);
  for (const i of r.issues) console.log(`  - ${i}`);
  if (!r.ok) ok = false;
}
process.exit(ok ? 0 : 1);
