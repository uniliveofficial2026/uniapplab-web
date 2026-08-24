export const UI_MANIFEST_SCHEMA_VERSION = 1;

export const REGISTERED_COMPONENT_IDS = new Set([
  "navigation.bottom.v1",
  "profile.header.v1",
  "profile.card.v1",
  "profile.screen.v1",
  "feed.post-card.v1",
  "feed.screen.v1",
  "chat.thread-row.v1",
  "chat.message-bubble.v1",
  "chat.inbox.v1",
  "live.room-header.v1",
  "live.viewer-counter.v1",
  "live.audio-seat.v1",
  "live.video-seat.v1",
  "live.gift-panel.v1",
  "live.pk-scoreboard.v1",
  "live.screen.v1",
  "wallet.balance-card.v1",
  "wallet.balance-card.compact",
  "wallet.coin-package.v1",
  "wallet.screen.v1",
  "notifications.list.v1",
  "settings.screen.v1",
  "auth.login.v1",
  "auth.signup.v1",
  "primitive.button.v1",
  "primitive.icon-button.v1",
  "primitive.icon.v1",
  "primitive.input.v1",
  "primitive.label.v1",
  "primitive.toggle.v1",
  "primitive.checkbox.v1",
  "primitive.radio.v1",
  "primitive.slider.v1",
  "primitive.avatar.v1",
  "primitive.badge.v1",
  "primitive.ring.v1",
  "primitive.frame.v1",
  "primitive.image.v1",
  "primitive.video.v1",
  "primitive.animation.v1",
  "primitive.modal.v1",
  "primitive.sheet.v1",
  "primitive.dialog.v1",
  "primitive.menu.v1",
  "primitive.dropdown.v1",
  "primitive.tooltip.v1",
  "primitive.popover.v1",
  "primitive.banner.v1",
  "primitive.toast.v1",
  "primitive.tab.v1",
  "primitive.header.v1",
  "primitive.footer.v1",
  "primitive.nav.v1",
  "primitive.panel.v1",
  "primitive.list.v1",
  "primitive.grid.v1",
  "primitive.row.v1",
  "primitive.column.v1",
  "state.loading.v1",
  "state.empty.v1",
  "state.error.v1",
  "fallback.empty.v1",
]);

export const REGISTERED_ACTION_IDS = new Set([
  "navigation.open",
  "profile.follow",
  "profile.block",
  "profile.open",
  "chat.openThread",
  "chat.sendMessage",
  "live.join",
  "live.leave",
  "live.close",
  "seat.request",
  "seat.accept",
  "seat.leave",
  "pk.invite",
  "pk.accept",
  "gift.send",
  "wallet.purchase",
  "notification.markRead",
]);

export const REGISTERED_BINDING_IDS = new Set([
  "profile.header",
  "profile.actions",
  "chat.threadList",
  "chat.activeThread",
  "live.header",
  "live.seats",
  "live.pk",
  "live.giftPanel",
  "wallet.summary",
  "wallet.packages",
  "notifications.list",
  "settings.form",
]);

export type ManifestIssue = { path: string; code: string; message: string };

const FORBIDDEN_KEY_RE =
  /^(sql|javascript|js|jsx|html|css|eval|secret|apiUrl|api_url|href|onclick|innerHTML|dangerouslySetInnerHTML)$/i;
const CODE_RE = /<\s*script|javascript:|new\s+Function|eval\s*\(|import\s*\(/i;
const URL_RE = /https?:\/\//i;
const SQL_RE = /\b(select|insert|update|delete|drop|alter)\b.+\b(from|into|table)\b/i;

function walkForbidden(value: unknown, path: string, out: ManifestIssue[]): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, i) => walkForbidden(item, `${path}[${i}]`, out));
    return;
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEY_RE.test(k)) {
      out.push({ path: `${path}.${k}`, code: "forbidden_key", message: `must not contain ${k}` });
    }
    if (typeof v === "string") {
      if (CODE_RE.test(v) || SQL_RE.test(v)) {
        out.push({ path: `${path}.${k}`, code: "forbidden_payload", message: "code or SQL is not allowed" });
      }
      if (URL_RE.test(v) && k !== "checksum") {
        out.push({ path: `${path}.${k}`, code: "forbidden_url", message: "URLs are not allowed in manifests" });
      }
    }
    walkForbidden(v, `${path}.${k}`, out);
  }
}

export function validateUiManifest(raw: unknown, translationKeys?: Set<string>): ManifestIssue[] {
  const issues: ManifestIssue[] = [];
  if (!raw || typeof raw !== "object") {
    return [{ path: "$", code: "invalid", message: "manifest must be an object" }];
  }
  const m = raw as Record<string, unknown>;
  if (m.schemaVersion !== UI_MANIFEST_SCHEMA_VERSION) {
    issues.push({ path: "schemaVersion", code: "unsupported_schema", message: "unsupported schema version" });
  }
  if (typeof m.experienceKey !== "string" || !m.experienceKey) {
    issues.push({ path: "experienceKey", code: "required", message: "experienceKey required" });
  }
  if (typeof m.version !== "number" || m.version < 1) {
    issues.push({ path: "version", code: "required", message: "version must be >= 1" });
  }
  const layout = m.layout as { type?: string; slots?: Array<Record<string, unknown>> } | undefined;
  if (!layout || !["stack", "grid", "single"].includes(String(layout.type))) {
    issues.push({ path: "layout.type", code: "unsupported_layout", message: "unsupported layout primitive" });
  }
  const slots = layout?.slots;
  if (!Array.isArray(slots) || slots.length === 0) {
    issues.push({ path: "layout.slots", code: "required", message: "slots required" });
  } else {
    slots.forEach((slot, i) => {
      const p = `layout.slots[${i}]`;
      if (!REGISTERED_COMPONENT_IDS.has(String(slot.componentId || ""))) {
        issues.push({ path: `${p}.componentId`, code: "unknown_component", message: String(slot.componentId) });
      }
      if (!REGISTERED_BINDING_IDS.has(String(slot.dataBinding || ""))) {
        issues.push({ path: `${p}.dataBinding`, code: "unknown_binding", message: String(slot.dataBinding) });
      }
      for (const action of Array.isArray(slot.actions) ? slot.actions : []) {
        if (!REGISTERED_ACTION_IDS.has(String(action))) {
          issues.push({ path: `${p}.actions`, code: "unknown_action", message: String(action) });
        }
      }
      if (translationKeys && typeof slot.titleKey === "string" && !translationKeys.has(slot.titleKey)) {
        issues.push({ path: `${p}.titleKey`, code: "unknown_i18n_key", message: String(slot.titleKey) });
      }
    });
  }
  walkForbidden(raw, "$", issues);
  return issues;
}

export function checksumJson(value: unknown): string {
  const json = JSON.stringify(value);
  let h = 2166136261;
  for (let i = 0; i < json.length; i += 1) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv1a-${(h >>> 0).toString(16)}`;
}

export function publicExperiencePayload(row: {
  experience_key?: string;
  version?: number;
  schema_version?: number;
  manifest_json?: unknown;
  checksum?: string;
  theme_version?: number;
}): Record<string, unknown> {
  return {
    experienceKey: row.experience_key,
    version: row.version,
    schemaVersion: row.schema_version,
    checksum: row.checksum,
    themeVersion: row.theme_version ?? null,
    manifest: row.manifest_json,
  };
}
