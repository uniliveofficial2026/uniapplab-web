import {
  REGISTERED_ACTION_IDS,
  REGISTERED_BINDING_IDS,
  REGISTERED_COMPONENT_IDS,
  checksumJson,
} from "./manifestValidate";

export const UI_NODE_SCHEMA_VERSION = 1;
export const MAX_NODE_DEPTH = 8;
export const MAX_NODE_COUNT = 200;

const TOKEN_NAME_RE = /^(color|typography|space|radius|border|shadow|opacity|zIndex|motion|size|breakpoint|safeArea|density)\.[a-zA-Z0-9.]+$/;
const ASSET_ID_RE = /^[a-z0-9]+(\.[a-z0-9_-]+)+$/i;
const NODE_ID_RE = /^[a-z0-9]+([.-][a-z0-9]+)*$/i;
const FORBIDDEN_KEY_RE =
  /^(sql|javascript|js|jsx|html|css|eval|secret|apiUrl|api_url|href|onclick|innerHTML|dangerouslySetInnerHTML|roleOverride|walletAmount|livekitGrant)$/i;
const CODE_RE = /<\s*script|javascript:|new\s+Function|eval\s*\(|import\s*\(/i;
const URL_RE = /https?:\/\//i;
const ALLOWED_ALIGN = new Set(["start", "center", "end", "stretch"]);
const ALLOWED_DIRECTION = new Set(["row", "column"]);
const ALLOWED_GRID_COLUMNS = new Set([1, 2, 3, 4, 6]);
const ALLOWED_BREAKPOINTS = new Set(["phone", "tablet", "desktop"]);

export type UiIssue = { path: string; code: string; message: string };

function walkForbidden(value: unknown, path: string, out: UiIssue[]): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => walkForbidden(item, `${path}[${i}]`, out));
    return;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEY_RE.test(k)) out.push({ path: `${path}.${k}`, code: "forbidden_key", message: k });
    if (typeof v === "string" && (CODE_RE.test(v) || URL_RE.test(v))) {
      out.push({ path: `${path}.${k}`, code: "forbidden_payload", message: "code or URL not allowed" });
    }
    walkForbidden(v, `${path}.${k}`, out);
  }
}

export function validateUiNode(
  node: unknown,
  knownKeys?: Set<string>,
  path = "$",
  depth = 0,
  counter = { n: 0 },
): UiIssue[] {
  const issues: UiIssue[] = [];
  if (depth > MAX_NODE_DEPTH) return [{ path, code: "max_depth", message: `exceeds ${MAX_NODE_DEPTH}` }];
  counter.n += 1;
  if (counter.n > MAX_NODE_COUNT) return [{ path, code: "max_nodes", message: `exceeds ${MAX_NODE_COUNT}` }];
  if (!node || typeof node !== "object") return [{ path, code: "invalid", message: "node must be an object" }];
  const n = node as Record<string, unknown>;
  if (typeof n.nodeId !== "string" || !NODE_ID_RE.test(n.nodeId)) {
    issues.push({ path: `${path}.nodeId`, code: "invalid_node_id", message: String(n.nodeId) });
  }
  if (!REGISTERED_COMPONENT_IDS.has(String(n.componentId || ""))) {
    issues.push({ path: `${path}.componentId`, code: "unknown_component", message: String(n.componentId) });
  }
  if (typeof n.componentVersion !== "number" || n.componentVersion < 1) {
    issues.push({ path: `${path}.componentVersion`, code: "required", message: "componentVersion >= 1" });
  }
  if (typeof n.variant !== "string" || !n.variant) {
    issues.push({ path: `${path}.variant`, code: "required", message: "variant required" });
  }
  if (n.dataBinding && !REGISTERED_BINDING_IDS.has(String(n.dataBinding))) {
    issues.push({ path: `${path}.dataBinding`, code: "unknown_binding", message: String(n.dataBinding) });
  }
  const actions = Array.isArray(n.actions) ? n.actions : [];
  for (const action of actions) {
    const id = String((action as { actionId?: unknown }).actionId || "");
    if (!REGISTERED_ACTION_IDS.has(id)) issues.push({ path: `${path}.actions`, code: "unknown_action", message: id });
  }
  const translationKeys = (n.translationKeys || {}) as Record<string, string>;
  for (const [slot, key] of Object.entries(translationKeys)) {
    if (knownKeys && !knownKeys.has(key)) {
      issues.push({ path: `${path}.translationKeys.${slot}`, code: "unknown_i18n_key", message: key });
    }
  }
  const assets = (n.assetBindings || {}) as Record<string, string>;
  for (const [slot, assetId] of Object.entries(assets)) {
    if (!ASSET_ID_RE.test(assetId)) issues.push({ path: `${path}.assetBindings.${slot}`, code: "invalid_asset_id", message: assetId });
  }
  const tokens = (n.tokenOverrides || {}) as Record<string, unknown>;
  for (const token of Object.keys(tokens)) {
    if (!TOKEN_NAME_RE.test(token)) issues.push({ path: `${path}.tokenOverrides`, code: "unknown_token", message: token });
  }
  const responsive = n.responsive as Record<string, unknown> | undefined;
  if (responsive) {
    if (responsive.breakpoint && !ALLOWED_BREAKPOINTS.has(String(responsive.breakpoint))) {
      issues.push({ path: `${path}.responsive.breakpoint`, code: "unsupported_responsive", message: String(responsive.breakpoint) });
    }
    if (responsive.columns != null && !ALLOWED_GRID_COLUMNS.has(Number(responsive.columns))) {
      issues.push({ path: `${path}.responsive.columns`, code: "unsupported_responsive", message: String(responsive.columns) });
    }
    if (responsive.direction && !ALLOWED_DIRECTION.has(String(responsive.direction))) {
      issues.push({ path: `${path}.responsive.direction`, code: "unsupported_responsive", message: String(responsive.direction) });
    }
    if (responsive.align && !ALLOWED_ALIGN.has(String(responsive.align))) {
      issues.push({ path: `${path}.responsive.align`, code: "unsupported_responsive", message: String(responsive.align) });
    }
  }
  walkForbidden(node, path, issues);
  const slots = (n.slots || {}) as Record<string, unknown>;
  for (const [slotName, children] of Object.entries(slots)) {
    if (!Array.isArray(children)) {
      issues.push({ path: `${path}.slots.${slotName}`, code: "invalid", message: "slots must be arrays" });
      continue;
    }
    children.forEach((child, i) => {
      issues.push(...validateUiNode(child, knownKeys, `${path}.slots.${slotName}[${i}]`, depth + 1, counter));
    });
  }
  return issues;
}

export function validateUiFragment(raw: unknown, knownKeys?: Set<string>): UiIssue[] {
  if (!raw || typeof raw !== "object") return [{ path: "$", code: "invalid", message: "fragment must be an object" }];
  const f = raw as Record<string, unknown>;
  const issues: UiIssue[] = [];
  if (f.schemaVersion !== UI_NODE_SCHEMA_VERSION) issues.push({ path: "schemaVersion", code: "unsupported_schema", message: String(f.schemaVersion) });
  if (!f.fragmentKey) issues.push({ path: "fragmentKey", code: "required", message: "fragmentKey required" });
  if (typeof f.version !== "number" || f.version < 1) issues.push({ path: "version", code: "required", message: "version >= 1" });
  if (!Array.isArray(f.requiredTranslationKeys)) {
    issues.push({ path: "requiredTranslationKeys", code: "required", message: "requiredTranslationKeys required" });
  } else if (knownKeys) {
    for (const key of f.requiredTranslationKeys as string[]) {
      if (!knownKeys.has(key)) issues.push({ path: "requiredTranslationKeys", code: "unknown_i18n_key", message: key });
    }
  }
  issues.push(...validateUiNode(f.root, knownKeys, "$.root"));
  return issues;
}

export const ALLOWED_SCOPE_KEYS = new Set([
  "platforms",
  "minAppVersion",
  "maxAppVersion",
  "regions",
  "segment",
  "experimentKey",
  "variantKey",
  "deviceClass",
  "roomTypes",
  "sessionTypes",
  "allocationPercentage",
  "userIds",
  "anonymousOnly",
]);

export function validateScopeConditions(raw: unknown): UiIssue[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return [{ path: "$", code: "invalid", message: "scope_conditions_json must be an object" }];
  }
  const issues: UiIssue[] = [];
  for (const key of Object.keys(raw as Record<string, unknown>)) {
    if (!ALLOWED_SCOPE_KEYS.has(key)) issues.push({ path: key, code: "unknown_scope_key", message: key });
  }
  walkForbidden(raw, "$", issues);
  return issues;
}

export function validateSnapshotLockfile(raw: unknown): UiIssue[] {
  if (!raw || typeof raw !== "object") return [{ path: "$", code: "invalid", message: "lockfile required" }];
  const l = raw as Record<string, unknown>;
  const issues: UiIssue[] = [];
  if (l.schemaVersion !== 1) issues.push({ path: "schemaVersion", code: "unsupported_schema", message: String(l.schemaVersion) });
  if (typeof l.snapshotId !== "string" || !l.snapshotId) issues.push({ path: "snapshotId", code: "required", message: "snapshotId required" });
  if (typeof l.checksum !== "string" || !l.checksum) issues.push({ path: "checksum", code: "required", message: "checksum required" });
  if (!l.experiences || typeof l.experiences !== "object") issues.push({ path: "experiences", code: "required", message: "experiences required" });
  if (!l.fragments || typeof l.fragments !== "object") issues.push({ path: "fragments", code: "required", message: "fragments required" });
  walkForbidden(raw, "$", issues);
  return issues;
}

export { checksumJson };
