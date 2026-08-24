/**
 * Storage boundary — maps to Cloudflare R2 / existing media architecture.
 * Does not duplicate assets.
 */

export function createUniLiveStorage(options = {}) {
  const driver = options.driver || null;
  return {
    provider: options.provider || 'cloudflare-r2',
    async upload(input) {
      if (!driver?.upload) throw Object.assign(new Error('storage_driver_required'), { code: 'STORAGE_DRIVER_REQUIRED' });
      return driver.upload(input);
    },
    async download(key) {
      if (!driver?.download) throw Object.assign(new Error('storage_driver_required'), { code: 'STORAGE_DRIVER_REQUIRED' });
      return driver.download(key);
    },
    async delete(key) {
      if (!driver?.delete) throw Object.assign(new Error('storage_driver_required'), { code: 'STORAGE_DRIVER_REQUIRED' });
      return driver.delete(key);
    },
    async list(prefix) {
      if (!driver?.list) return [];
      return driver.list(prefix);
    },
    async signedUrl(key, opts) {
      if (!driver?.signedUrl) throw Object.assign(new Error('storage_driver_required'), { code: 'STORAGE_DRIVER_REQUIRED' });
      return driver.signedUrl(key, opts);
    },
  };
}
