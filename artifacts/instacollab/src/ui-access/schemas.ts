export { UI_ACCESS_SCHEMA_VERSION } from './generated/schemas.generated';

export const UI_ACCESS_FORBIDDEN_PATTERN =
  /<\s*script|javascript:|new\s+Function|eval\s*\(|service[_-]?role|livekit.*secret|BEGIN (RSA |OPENSSH )?PRIVATE/i;

export function assertSafeUiJson(value: unknown, label = 'ui-json'): void {
  const text = JSON.stringify(value);
  if (UI_ACCESS_FORBIDDEN_PATTERN.test(text)) {
    throw new Error(`[ui-access] forbidden payload in ${label}`);
  }
}
