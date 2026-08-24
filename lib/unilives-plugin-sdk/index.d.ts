export type PluginManifest = {
  id: string;
  name: string;
  version: string;
  kind: string;
  capabilities: string[];
  entry?: string;
};
export function validatePluginManifest(manifest: PluginManifest): true;
export function createExampleButtonPlugin(): { manifest: PluginManifest; component: { componentType: string; defaultProps: Record<string, unknown> } };
export function registerPlugin(registry: Map<string, unknown>, plugin: { manifest: PluginManifest }): string;
