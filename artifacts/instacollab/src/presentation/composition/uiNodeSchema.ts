import { isActionId } from './actionRegistry';
import { isBindingId } from './bindingRegistry';
import { isRegisteredComponentId } from './componentIds';

export const UI_NODE_SCHEMA_VERSION = 1;
export const MAX_NODE_DEPTH = 8;
export const MAX_NODE_COUNT = 200;

export const TOKEN_NAME_RE = /^(color|typography|space|radius|border|shadow|opacity|zIndex|motion|size|breakpoint|safeArea|density)\.[a-zA-Z0-9.]+$/;
export const ASSET_ID_RE = /^[a-z0-9]+(\.[a-z0-9_-]+)+$/i;
export const NODE_ID_RE = /^[a-z0-9]+([.-][a-z0-9]+)*$/i;

const ALLOWED_ALIGN = new Set(['start', 'center', 'end', 'stretch']);
const ALLOWED_DIRECTION = new Set(['row', 'column']);
const ALLOWED_GRID_COLUMNS = new Set([1, 2, 3, 4, 6]);
const ALLOWED_BREAKPOINTS = new Set(['phone', 'tablet', 'desktop']);

const FORBIDDEN_KEY_RE =
  /^(sql|javascript|js|jsx|html|css|eval|secret|apiUrl|api_url|href|onclick|innerHTML|dangerouslySetInnerHTML|roleOverride|walletAmount|livekitGrant)$/i;
const CODE_RE = /<\s*script|javascript:|new\s+Function|eval\s*\(|import\s*\(/i;
const URL_RE = /https?:\/\//i;

export type UiActionBinding = { actionId: string; params?: Record<string, unknown> };

export type UiVisibilityRule = {
  when?: 'always' | 'authenticated' | 'anonymous' | 'permission';
  permissionKey?: string;
};

export type UiResponsiveRule = {
  breakpoint?: 'phone' | 'tablet' | 'desktop';
  hidden?: boolean;
  columns?: 1 | 2 | 3 | 4 | 6;
  direction?: 'row' | 'column';
  align?: 'start' | 'center' | 'end' | 'stretch';
};

export type UiAccessibilityConfig = {
  labelKey?: string;
  hintKey?: string;
  live?: 'off' | 'polite' | 'assertive';
};

export type UiNode = {
  nodeId: string;
  componentId: string;
  componentVersion: number;
  variant: string;
  translationKeys?: Record<string, string>;
  assetBindings?: Record<string, string>;
  tokenOverrides?: Record<string, string | number>;
  safeProps?: Record<string, unknown>;
  dataBinding?: string;
  actions?: UiActionBinding[];
  visibility?: UiVisibilityRule;
  responsive?: UiResponsiveRule;
  accessibility?: UiAccessibilityConfig;
  slots?: Record<string, UiNode[]>;
};

export type UiIssue = { path: string; code: string; message: string };

function walkForbidden(value: unknown, path: string, out: UiIssue[]): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => walkForbidden(item, `${path}[${i}]`, out));
    return;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEY_RE.test(k)) out.push({ path: `${path}.${k}`, code: 'forbidden_key', message: k });
    if (typeof v === 'string' && (CODE_RE.test(v) || URL_RE.test(v))) {
      out.push({ path: `${path}.${k}`, code: 'forbidden_payload', message: 'code or URL not allowed' });
    }
    walkForbidden(v, `${path}.${k}`, out);
  }
}

export function validateUiNode(
  node: unknown,
  knownKeys?: Set<string>,
  path = '$',
  depth = 0,
  counter = { n: 0 },
): UiIssue[] {
  const issues: UiIssue[] = [];
  if (depth > MAX_NODE_DEPTH) {
    return [{ path, code: 'max_depth', message: `exceeds ${MAX_NODE_DEPTH}` }];
  }
  counter.n += 1;
  if (counter.n > MAX_NODE_COUNT) {
    return [{ path, code: 'max_nodes', message: `exceeds ${MAX_NODE_COUNT}` }];
  }
  if (!node || typeof node !== 'object') {
    return [{ path, code: 'invalid', message: 'node must be an object' }];
  }
  const n = node as Partial<UiNode>;
  if (!n.nodeId || !NODE_ID_RE.test(n.nodeId)) issues.push({ path: `${path}.nodeId`, code: 'invalid_node_id', message: String(n.nodeId) });
  if (!isRegisteredComponentId(String(n.componentId || ''))) {
    issues.push({ path: `${path}.componentId`, code: 'unknown_component', message: String(n.componentId) });
  }
  if (typeof n.componentVersion !== 'number' || n.componentVersion < 1) {
    issues.push({ path: `${path}.componentVersion`, code: 'required', message: 'componentVersion >= 1' });
  }
  if (typeof n.variant !== 'string' || !n.variant) {
    issues.push({ path: `${path}.variant`, code: 'required', message: 'variant required' });
  }
  if (n.dataBinding && !isBindingId(n.dataBinding)) {
    issues.push({ path: `${path}.dataBinding`, code: 'unknown_binding', message: n.dataBinding });
  }
  for (const action of n.actions || []) {
    if (!isActionId(String(action.actionId || ''))) {
      issues.push({ path: `${path}.actions`, code: 'unknown_action', message: String(action.actionId) });
    }
  }
  for (const [slot, key] of Object.entries(n.translationKeys || {})) {
    if (knownKeys && !knownKeys.has(key)) {
      issues.push({ path: `${path}.translationKeys.${slot}`, code: 'unknown_i18n_key', message: key });
    }
  }
  if (n.accessibility?.labelKey && knownKeys && !knownKeys.has(n.accessibility.labelKey)) {
    issues.push({ path: `${path}.accessibility.labelKey`, code: 'unknown_i18n_key', message: n.accessibility.labelKey });
  }
  for (const [slot, assetId] of Object.entries(n.assetBindings || {})) {
    if (!ASSET_ID_RE.test(assetId)) {
      issues.push({ path: `${path}.assetBindings.${slot}`, code: 'invalid_asset_id', message: assetId });
    }
  }
  for (const token of Object.keys(n.tokenOverrides || {})) {
    if (!TOKEN_NAME_RE.test(token)) {
      issues.push({ path: `${path}.tokenOverrides`, code: 'unknown_token', message: token });
    }
  }
  if (n.responsive) {
    if (n.responsive.breakpoint && !ALLOWED_BREAKPOINTS.has(n.responsive.breakpoint)) {
      issues.push({ path: `${path}.responsive.breakpoint`, code: 'unsupported_responsive', message: n.responsive.breakpoint });
    }
    if (n.responsive.columns != null && !ALLOWED_GRID_COLUMNS.has(n.responsive.columns)) {
      issues.push({ path: `${path}.responsive.columns`, code: 'unsupported_responsive', message: String(n.responsive.columns) });
    }
    if (n.responsive.direction && !ALLOWED_DIRECTION.has(n.responsive.direction)) {
      issues.push({ path: `${path}.responsive.direction`, code: 'unsupported_responsive', message: n.responsive.direction });
    }
    if (n.responsive.align && !ALLOWED_ALIGN.has(n.responsive.align)) {
      issues.push({ path: `${path}.responsive.align`, code: 'unsupported_responsive', message: n.responsive.align });
    }
  }
  walkForbidden(node, path, issues);
  for (const [slotName, children] of Object.entries(n.slots || {})) {
    if (!Array.isArray(children)) {
      issues.push({ path: `${path}.slots.${slotName}`, code: 'invalid', message: 'slots must be arrays' });
      continue;
    }
    children.forEach((child, i) => {
      issues.push(...validateUiNode(child, knownKeys, `${path}.slots.${slotName}[${i}]`, depth + 1, counter));
    });
  }
  return issues;
}

export type UiFragmentContent = {
  schemaVersion: number;
  fragmentKey: string;
  version: number;
  requiredTranslationKeys: string[];
  compatibleRoomTypes?: string[];
  root: UiNode;
};

export function validateUiFragment(raw: unknown, knownKeys?: Set<string>): UiIssue[] {
  if (!raw || typeof raw !== 'object') return [{ path: '$', code: 'invalid', message: 'fragment must be an object' }];
  const f = raw as Partial<UiFragmentContent>;
  const issues: UiIssue[] = [];
  if (f.schemaVersion !== UI_NODE_SCHEMA_VERSION) issues.push({ path: 'schemaVersion', code: 'unsupported_schema', message: String(f.schemaVersion) });
  if (!f.fragmentKey) issues.push({ path: 'fragmentKey', code: 'required', message: 'fragmentKey required' });
  if (typeof f.version !== 'number' || f.version < 1) issues.push({ path: 'version', code: 'required', message: 'version >= 1' });
  if (!Array.isArray(f.requiredTranslationKeys)) issues.push({ path: 'requiredTranslationKeys', code: 'required', message: 'requiredTranslationKeys required' });
  else if (knownKeys) {
    for (const key of f.requiredTranslationKeys) {
      if (!knownKeys.has(key)) issues.push({ path: 'requiredTranslationKeys', code: 'unknown_i18n_key', message: key });
    }
  }
  issues.push(...validateUiNode(f.root, knownKeys, '$.root'));
  return issues;
}

export function collectNodeIds(node: UiNode, out: string[] = []): string[] {
  out.push(node.nodeId);
  for (const children of Object.values(node.slots || {})) {
    for (const child of children) collectNodeIds(child, out);
  }
  return out;
}

export function patchNode(root: UiNode, nodeId: string, patch: Partial<UiNode>): UiNode | null {
  if (root.nodeId === nodeId) return { ...root, ...patch, nodeId: root.nodeId, slots: patch.slots ?? root.slots };
  if (!root.slots) return null;
  const nextSlots: Record<string, UiNode[]> = {};
  let found = false;
  for (const [slot, children] of Object.entries(root.slots)) {
    nextSlots[slot] = children.map((child) => {
      const patched = patchNode(child, nodeId, patch);
      if (patched) {
        found = true;
        return patched;
      }
      return child;
    });
  }
  return found ? { ...root, slots: nextSlots } : null;
}
