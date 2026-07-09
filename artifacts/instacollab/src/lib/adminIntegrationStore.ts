import { db } from './db/localDb';
import type { IntegrationServiceDef } from './adminIntegrations';
import { BUILTIN_INTEGRATION_SERVICES } from './adminIntegrations';

const CUSTOM_KEY = 'admin_custom_integrations';
const OVERRIDE_KEY = 'admin_integration_overrides';

export type IntegrationServiceOverride = Partial<Omit<IntegrationServiceDef, 'id'>>;

export function listCustomIntegrations(): IntegrationServiceDef[] {
  return db.load<IntegrationServiceDef[]>(CUSTOM_KEY, []);
}

export function listIntegrationOverrides(): Record<string, IntegrationServiceOverride> {
  return db.load<Record<string, IntegrationServiceOverride>>(OVERRIDE_KEY, {});
}

export function upsertCustomIntegration(service: IntegrationServiceDef): void {
  const items = listCustomIntegrations();
  const idx = items.findIndex((row) => row.id === service.id);
  if (idx >= 0) items[idx] = service;
  else items.unshift(service);
  db.save(CUSTOM_KEY, items);
  db.addAuditLog?.({ id: Date.now(), text: `Integration saved: ${service.name}`, time: 'Just now' });
}

export function deleteCustomIntegration(id: string): void {
  db.save(CUSTOM_KEY, listCustomIntegrations().filter((row) => row.id !== id));
  db.addAuditLog?.({ id: Date.now(), text: `Integration removed: ${id}`, time: 'Just now' });
}

export function upsertIntegrationOverride(id: string, patch: IntegrationServiceOverride): void {
  const overrides = listIntegrationOverrides();
  overrides[id] = { ...overrides[id], ...patch };
  db.save(OVERRIDE_KEY, overrides);
  db.addAuditLog?.({ id: Date.now(), text: `Integration updated: ${id}`, time: 'Just now' });
}

export function resetIntegrationOverride(id: string): void {
  const overrides = listIntegrationOverrides();
  delete overrides[id];
  db.save(OVERRIDE_KEY, overrides);
}

export function getAllIntegrationServices(): IntegrationServiceDef[] {
  const overrides = listIntegrationOverrides();
  const mergedBuiltins = BUILTIN_INTEGRATION_SERVICES.map((service) => {
    const patch = overrides[service.id];
    if (!patch) return service;
    return {
      ...service,
      ...patch,
      envKeys: patch.envKeys?.length ? patch.envKeys : service.envKeys,
      packages: patch.packages?.length ? patch.packages : service.packages,
      files: patch.files?.length ? patch.files : service.files,
      scripts: patch.scripts?.length ? patch.scripts : service.scripts,
    };
  });
  return [...mergedBuiltins, ...listCustomIntegrations()];
}

export function isBuiltinIntegration(id: string): boolean {
  return BUILTIN_INTEGRATION_SERVICES.some((service) => service.id === id);
}

export function createEmptyCustomIntegration(): IntegrationServiceDef {
  const stamp = Date.now();
  return {
    id: `custom-${stamp}`,
    name: 'New integration',
    description: 'Custom SDK / API / env configuration',
    envKeys: [`VITE_CUSTOM_${stamp}_KEY`],
    packages: [],
    files: [],
    scripts: [],
  };
}
