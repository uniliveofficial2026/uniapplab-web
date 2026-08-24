import { ACTION_IDS, isActionId } from './actionRegistry';
import { BINDING_IDS, isBindingId } from './bindingRegistry';
import { isRegisteredComponentId } from './componentIds';

export const UI_MANIFEST_SCHEMA_VERSION = 1;
export const MIN_APP_VERSION = '0.0.0';

export type LayoutPrimitive = 'stack' | 'grid' | 'single';

export type ManifestSlot = {
  id: string;
  componentId: string;
  variant?: string;
  dataBinding: string;
  actions?: string[];
  visible?: boolean;
  titleKey?: string;
  accessibilityLabelKey?: string;
  assetId?: string;
};

export type UiExperienceManifest = {
  schemaVersion: number;
  experienceKey: string;
  version: number;
  platform: 'all' | 'web' | 'ios' | 'android';
  themeVersion: number;
  minAppVersion?: string;
  maxAppVersion?: string;
  layout: {
    type: LayoutPrimitive;
    slots: ManifestSlot[];
  };
};

export type ManifestValidationIssue = {
  path: string;
  code: string;
  message: string;
};

const FORBIDDEN_KEY_RE =
  /^(sql|javascript|js|jsx|html|css|eval|secret|apiUrl|api_url|href|onclick|innerHTML|dangerouslySetInnerHTML)$/i;
const CODE_RE = /<\s*script|javascript:|new\s+Function|eval\s*\(|import\s*\(/i;
const URL_RE = /https?:\/\//i;
const SQL_RE = /\b(select|insert|update|delete|drop|alter)\b.+\b(from|into|table)\b/i;

export function collectForbiddenKeys(value: unknown, path = '$', out: ManifestValidationIssue[] = []): ManifestValidationIssue[] {
  if (!value || typeof value !== 'object') return out;
  if (Array.isArray(value)) {
    value.forEach((item, i) => collectForbiddenKeys(item, `${path}[${i}]`, out));
    return out;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEY_RE.test(k)) {
      out.push({ path: `${path}.${k}`, code: 'forbidden_key', message: `Manifest must not contain ${k}` });
    }
    if (typeof v === 'string') {
      if (CODE_RE.test(v) || SQL_RE.test(v)) {
        out.push({ path: `${path}.${k}`, code: 'forbidden_payload', message: 'Manifest payload looks like code or SQL' });
      }
      if (URL_RE.test(v) && k !== 'checksum') {
        out.push({ path: `${path}.${k}`, code: 'forbidden_url', message: 'Manifest must not contain API/network URLs' });
      }
    }
    collectForbiddenKeys(v, `${path}.${k}`, out);
  }
  return out;
}

export function validateUiManifest(
  raw: unknown,
  knownTranslationKeys?: Set<string>,
): ManifestValidationIssue[] {
  const issues: ManifestValidationIssue[] = [];
  if (!raw || typeof raw !== 'object') {
    return [{ path: '$', code: 'invalid', message: 'Manifest must be an object' }];
  }
  const m = raw as Partial<UiExperienceManifest>;
  if (m.schemaVersion !== UI_MANIFEST_SCHEMA_VERSION) {
    issues.push({ path: 'schemaVersion', code: 'unsupported_schema', message: `schemaVersion must be ${UI_MANIFEST_SCHEMA_VERSION}` });
  }
  if (!m.experienceKey || typeof m.experienceKey !== 'string') {
    issues.push({ path: 'experienceKey', code: 'required', message: 'experienceKey required' });
  }
  if (typeof m.version !== 'number' || m.version < 1) {
    issues.push({ path: 'version', code: 'required', message: 'version must be >= 1' });
  }
  if (!['all', 'web', 'ios', 'android'].includes(String(m.platform || ''))) {
    issues.push({ path: 'platform', code: 'invalid', message: 'unsupported platform' });
  }
  if (typeof m.themeVersion !== 'number') {
    issues.push({ path: 'themeVersion', code: 'required', message: 'themeVersion required' });
  }
  const layoutType = m.layout?.type;
  if (!layoutType || !['stack', 'grid', 'single'].includes(layoutType)) {
    issues.push({ path: 'layout.type', code: 'unsupported_layout', message: 'layout primitive not supported' });
  }
  const slots = m.layout?.slots;
  if (!Array.isArray(slots) || slots.length === 0) {
    issues.push({ path: 'layout.slots', code: 'required', message: 'at least one slot required' });
  } else {
    slots.forEach((slot, i) => {
      const p = `layout.slots[${i}]`;
      if (!isRegisteredComponentId(String(slot.componentId || ''))) {
        issues.push({ path: `${p}.componentId`, code: 'unknown_component', message: String(slot.componentId) });
      }
      if (!isBindingId(String(slot.dataBinding || ''))) {
        issues.push({ path: `${p}.dataBinding`, code: 'unknown_binding', message: String(slot.dataBinding) });
      }
      for (const action of slot.actions || []) {
        if (!isActionId(action)) {
          issues.push({ path: `${p}.actions`, code: 'unknown_action', message: action });
        }
      }
      if (slot.titleKey && knownTranslationKeys && !knownTranslationKeys.has(slot.titleKey)) {
        issues.push({ path: `${p}.titleKey`, code: 'unknown_i18n_key', message: slot.titleKey });
      }
      if (slot.accessibilityLabelKey && knownTranslationKeys && !knownTranslationKeys.has(slot.accessibilityLabelKey)) {
        issues.push({ path: `${p}.accessibilityLabelKey`, code: 'unknown_i18n_key', message: slot.accessibilityLabelKey });
      }
    });
  }
  issues.push(...collectForbiddenKeys(raw));
  return issues;
}

export { ACTION_IDS, BINDING_IDS };
