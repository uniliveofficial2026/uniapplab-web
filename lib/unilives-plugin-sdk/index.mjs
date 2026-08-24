import { ValidationError, PermissionError } from '@unilives/errors';

const KINDS = new Set(['component', 'template', 'action', 'function', 'integration', 'observability']);
const DANGEROUS = new Set(['database.admin', 'filesystem', 'provider.secrets', 'deploy.admin']);

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   version: string,
 *   kind: string,
 *   capabilities: string[],
 *   entry?: string,
 * }} PluginManifest
 */

/**
 * @param {PluginManifest} manifest
 */
export function validatePluginManifest(manifest) {
  if (!manifest?.id || !manifest?.name || !manifest?.version) {
    throw new ValidationError('invalid_plugin_manifest');
  }
  if (!KINDS.has(manifest.kind)) {
    throw new ValidationError('unsupported_plugin_kind', { details: { kind: manifest.kind } });
  }
  if (!Array.isArray(manifest.capabilities)) {
    throw new ValidationError('capabilities_required');
  }
  for (const cap of manifest.capabilities) {
    if (DANGEROUS.has(cap)) {
      throw new PermissionError('dangerous_capability_not_auto_granted', { details: { capability: cap } });
    }
  }
  return true;
}

/**
 * Example safe Builder component plugin.
 */
export function createExampleButtonPlugin() {
  const manifest = {
    id: 'example.button',
    name: 'Example Button',
    version: '0.1.0',
    kind: 'component',
    capabilities: ['builder.component'],
    entry: 'example-button',
  };
  validatePluginManifest(manifest);
  return {
    manifest,
    component: {
      componentType: 'ExampleButton',
      defaultProps: { label: 'Click' },
    },
  };
}

export function registerPlugin(registry, plugin) {
  validatePluginManifest(plugin.manifest);
  if (!registry || typeof registry.set !== 'function') throw new ValidationError('registry_required');
  registry.set(plugin.manifest.id, plugin);
  return plugin.manifest.id;
}
