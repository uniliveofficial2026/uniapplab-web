export const PUBLIC_RUNTIME_SCHEMA_VERSION = 1;

export function isPublicConfigCompatible(schemaVersion: number, environment: string): boolean {
  if (schemaVersion !== PUBLIC_RUNTIME_SCHEMA_VERSION) return false;
  if (environment === 'production') return true;
  return ['local', 'test', 'preview', 'staging', 'production'].includes(environment);
}

export function assertNoSecretFields(obj: Record<string, unknown>): void {
  const forbidden = ['secret', 'secretReference', 'serviceRole', 'privateKey', 'webhookSecret'];
  const json = JSON.stringify(obj).toLowerCase();
  for (const key of forbidden) {
    if (Object.keys(obj).some((k) => k.toLowerCase().includes(key))) {
      throw new Error('public config cannot include secret fields');
    }
    if (json.includes(`"${key.toLowerCase()}"`)) {
      throw new Error('public config cannot include secret fields');
    }
  }
}
