import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { join, resolve, normalize } from 'node:path';
import { ValidationError, PermissionError, NotFoundError, ConflictError } from '@unilives/errors';
import { STAGE_C_TEMPLATE_MANIFESTS } from './seed/stage-c-templates.mjs';

export { STAGE_C_TEMPLATE_MANIFESTS };

export const MANIFEST_TYPES = new Set(['template', 'plugin', 'provider']);
export const PRIVILEGED_PERMISSIONS = new Set([
  'secret.read',
  'db.admin',
  'deploy.mutate',
  'filesystem.root',
  'shell',
]);

const REQUIRED_FIELDS = [
  'id',
  'name',
  'publisher',
  'version',
  'type',
  'description',
  'capabilities',
  'compatibility',
  'integrity',
  'entrypoint',
  'permissions',
  'metadata',
];

const SECRET_KEY_PATTERN = /secret|password|token|apikey|private.?key|credential/i;

/**
 * @typedef {Object} MarketplaceManifest
 * @property {string} id
 * @property {string} name
 * @property {string} publisher
 * @property {string} version
 * @property {'template'|'plugin'|'provider'} type
 * @property {string} description
 * @property {string[]} capabilities
 * @property {{ platform?: string, schemaVersion?: number }} compatibility
 * @property {{ algorithm: string, hash: string }} integrity
 * @property {string} entrypoint
 * @property {string[]} permissions
 * @property {Record<string, unknown>} metadata
 */

/**
 * @param {unknown} manifest
 * @returns {{ ok: true, manifest: MarketplaceManifest } | { ok: false, errors: string[] }}
 */
export function validateManifest(manifest) {
  /** @type {string[]} */
  const errors = [];
  if (!manifest || typeof manifest !== 'object') {
    return { ok: false, errors: ['manifest_must_be_object'] };
  }
  const m = /** @type {Record<string, unknown>} */ (manifest);

  for (const field of REQUIRED_FIELDS) {
    if (m[field] === undefined || m[field] === null) errors.push(`missing_field:${field}`);
  }
  if (typeof m.id !== 'string' || !/^[\w.-]+$/.test(m.id)) errors.push('invalid_id');
  if (typeof m.version !== 'string' || !/^\d+\.\d+\.\d+/.test(m.version)) errors.push('invalid_version');
  if (!MANIFEST_TYPES.has(String(m.type))) errors.push('invalid_type');
  if (!Array.isArray(m.capabilities) || m.capabilities.some((c) => typeof c !== 'string')) {
    errors.push('invalid_capabilities');
  }
  if (!Array.isArray(m.permissions) || m.permissions.some((p) => typeof p !== 'string')) {
    errors.push('invalid_permissions');
  }
  if (!m.compatibility || typeof m.compatibility !== 'object') errors.push('invalid_compatibility');
  if (!m.integrity || typeof m.integrity !== 'object') errors.push('invalid_integrity');
  else {
    const integ = /** @type {{ algorithm?: string, hash?: string }} */ (m.integrity);
    if (integ.algorithm !== 'sha256' || typeof integ.hash !== 'string' || !/^[a-f0-9]{64}$/.test(integ.hash)) {
      errors.push('invalid_integrity_hash');
    }
  }
  if (typeof m.entrypoint !== 'string' || m.entrypoint.includes('..')) errors.push('invalid_entrypoint');

  for (const key of Object.keys(m)) {
    if (SECRET_KEY_PATTERN.test(key)) errors.push(`secret_field_in_manifest:${key}`);
  }
  scanForSecrets(m, 'manifest', errors);

  if (errors.length) return { ok: false, errors };
  return { ok: true, manifest: /** @type {MarketplaceManifest} */ (m) };
}

/**
 * @param {unknown} value
 * @param {string} path
 * @param {string[]} errors
 */
function scanForSecrets(value, path, errors) {
  if (value === null || value === undefined) return;
  if (typeof value === 'string') {
    if (/^(sk_|pk_live_|Bearer\s)/i.test(value)) errors.push(`secret_value_detected:${path}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => scanForSecrets(v, `${path}[${i}]`, errors));
    return;
  }
  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (SECRET_KEY_PATTERN.test(k)) errors.push(`secret_key_detected:${path}.${k}`);
      scanForSecrets(v, `${path}.${k}`, errors);
    }
  }
}

/**
 * @param {MarketplaceManifest} manifest
 * @param {{ platformVersion?: string }} [ctx]
 */
export function validateCompatibility(manifest, ctx = {}) {
  const platformVersion = ctx.platformVersion || '0.1.0';
  const min = String(manifest.compatibility?.platform || '').replace(/^>=/, '');
  if (min && compareSemver(platformVersion, min) < 0) {
    throw new ValidationError('incompatible_platform', {
      details: { required: manifest.compatibility.platform, current: platformVersion },
    });
  }
  const schemaVersion = Number(manifest.compatibility?.schemaVersion ?? 1);
  if (schemaVersion !== 1) {
    throw new ValidationError('incompatible_schema_version', { details: { schemaVersion } });
  }
  return true;
}

function compareSemver(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da !== db) return da - db;
  }
  return 0;
}

/**
 * @param {MarketplaceManifest} manifest
 */
export function computeManifestIntegrity(manifest) {
  const { integrity: _ignored, ...rest } = manifest;
  const canonical = JSON.stringify(rest);
  return createHash('sha256').update(canonical).digest('hex');
}

/**
 * @param {MarketplaceManifest} manifest
 */
export function verifyIntegrity(manifest) {
  const expected = computeManifestIntegrity(manifest);
  if (manifest.integrity?.hash !== expected) {
    throw new ValidationError('integrity_mismatch', {
      details: { expected, actual: manifest.integrity?.hash },
    });
  }
  return true;
}

/**
 * @param {MarketplaceManifest} manifest
 * @param {{ grantedPermissions?: string[] }} [opts]
 */
export function validateInstallSafety(manifest, opts = {}) {
  const validated = validateManifest(manifest);
  if (!validated.ok) {
    throw new ValidationError('invalid_manifest', { details: { errors: validated.errors } });
  }
  validateCompatibility(validated.manifest);
  verifyIntegrity(validated.manifest);

  const granted = new Set(opts.grantedPermissions || []);
  const privileged = validated.manifest.permissions.filter((p) => PRIVILEGED_PERMISSIONS.has(p));
  const missing = privileged.filter((p) => !granted.has(p));
  if (missing.length) {
    throw new PermissionError('privileged_permissions_not_granted', {
      details: { required: missing, autoGrantBlocked: true },
    });
  }
  return validated.manifest;
}

/**
 * @param {{ registryDir?: string, seed?: boolean }} [options]
 */
export function createMarketplaceRegistry(options = {}) {
  const registryDir = options.registryDir ? resolve(options.registryDir) : null;
  /** @type {Map<string, MarketplaceManifest>} */
  const catalog = new Map();
  /** @type {Map<string, { manifest: MarketplaceManifest, installedAt: string, grantedPermissions: string[] }>} */
  const installed = new Map();

  if (options.seed !== false) {
    for (const manifest of STAGE_C_TEMPLATE_MANIFESTS) {
      catalog.set(manifest.id, structuredClone(manifest));
    }
  }

  async function persistCatalog() {
    if (!registryDir) return;
    await mkdir(registryDir, { recursive: true });
    await writeFile(join(registryDir, 'catalog.json'), JSON.stringify([...catalog.values()], null, 2));
  }

  async function persistInstalled() {
    if (!registryDir) return;
    await mkdir(registryDir, { recursive: true });
    const rows = [...installed.entries()].map(([id, row]) => ({ id, ...row }));
    await writeFile(join(registryDir, 'installed.json'), JSON.stringify(rows, null, 2));
  }

  return {
    /** @param {MarketplaceManifest} manifest */
    register(manifest) {
      const validated = validateManifest(manifest);
      if (!validated.ok) throw new ValidationError('invalid_manifest', { details: { errors: validated.errors } });
      verifyIntegrity(validated.manifest);
      catalog.set(validated.manifest.id, structuredClone(validated.manifest));
      return validated.manifest;
    },

    list(filter = {}) {
      let rows = [...catalog.values()];
      if (filter.type) rows = rows.filter((m) => m.type === filter.type);
      if (filter.installedOnly) {
        const ids = new Set(installed.keys());
        rows = rows.filter((m) => ids.has(m.id));
      }
      return rows.map((m) => ({
        id: m.id,
        name: m.name,
        publisher: m.publisher,
        version: m.version,
        type: m.type,
        description: m.description,
        installed: installed.has(m.id),
      }));
    },

    search(query, filter = {}) {
      const q = String(query || '')
        .trim()
        .toLowerCase();
      return this.list(filter).filter((row) => {
        if (!q) return true;
        const hay = `${row.id} ${row.name} ${row.description} ${row.publisher}`.toLowerCase();
        return hay.includes(q);
      });
    },

    get(id) {
      const manifest = catalog.get(id);
      if (!manifest) throw new NotFoundError('artifact_not_found', { details: { id } });
      return structuredClone(manifest);
    },

    /**
     * @param {string} id
     * @param {{ grantedPermissions?: string[], installDir?: string }} [opts]
     */
    async install(id, opts = {}) {
      const manifest = this.get(id);
      const safe = validateInstallSafety(manifest, { grantedPermissions: opts.grantedPermissions });
      if (installed.has(id)) throw new ConflictError('already_installed', { details: { id } });

      if (opts.installDir && registryDir) {
        const target = resolve(registryDir, 'packages', id);
        const normalized = normalize(target);
        if (!normalized.startsWith(resolve(registryDir))) {
          throw new ValidationError('path_traversal_blocked');
        }
        await mkdir(target, { recursive: true });
        await writeFile(join(target, 'manifest.json'), JSON.stringify(safe, null, 2));
        await writeFile(
          join(target, 'entry.mjs'),
          `export default { id: ${JSON.stringify(safe.id)}, type: ${JSON.stringify(safe.type)} };\n`,
        );
      }

      installed.set(id, {
        manifest: safe,
        installedAt: new Date().toISOString(),
        grantedPermissions: [...(opts.grantedPermissions || [])],
      });
      await persistCatalog();
      await persistInstalled();
      return { ok: true, id, manifest: safe };
    },

    async remove(id) {
      if (!installed.has(id)) throw new NotFoundError('not_installed', { details: { id } });
      installed.delete(id);
      if (registryDir) {
        const pkgDir = join(registryDir, 'packages', id);
        await rm(pkgDir, { recursive: true, force: true });
      }
      await persistInstalled();
      return { ok: true, id };
    },

    validate(id) {
      const manifest = catalog.get(id);
      if (!manifest) throw new NotFoundError('artifact_not_found', { details: { id } });
      return validateManifest(manifest);
    },

    isInstalled(id) {
      return installed.has(id);
    },

    getInstalled() {
      return [...installed.keys()];
    },

    async loadFromDisk() {
      if (!registryDir) return;
      try {
        const raw = await readFile(join(registryDir, 'catalog.json'), 'utf8');
        const rows = JSON.parse(raw);
        for (const row of rows) this.register(row);
      } catch {
        /* empty catalog on first run */
      }
      try {
        const raw = await readFile(join(registryDir, 'installed.json'), 'utf8');
        const rows = JSON.parse(raw);
        for (const row of rows) {
          installed.set(row.id, {
            manifest: row.manifest,
            installedAt: row.installedAt,
            grantedPermissions: row.grantedPermissions || [],
          });
        }
      } catch {
        /* none installed yet */
      }
    },

    async listPackageFiles(id) {
      if (!registryDir) return [];
      const pkgDir = join(registryDir, 'packages', id);
      try {
        return await readdir(pkgDir);
      } catch {
        return [];
      }
    },
  };
}

export function listSeedTemplates() {
  return STAGE_C_TEMPLATE_MANIFESTS.map((m) => ({ id: m.id, name: m.name, type: m.type }));
}
