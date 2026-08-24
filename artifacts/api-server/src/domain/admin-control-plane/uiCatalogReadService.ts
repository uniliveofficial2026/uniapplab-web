import { readFileSync } from "node:fs";
import { join } from "node:path";
import { repoPath } from "../../lib/repoRoot";
import { REGISTERED_ACTION_IDS, REGISTERED_BINDING_IDS, REGISTERED_COMPONENT_IDS } from "../uiConfig/manifestValidate";
import { listDefinitions } from "../../config/RuntimeConfigService";
import { RUNTIME_CONFIG_INVENTORY } from "../../config/generated/inventory.generated";

function catalogRoot(): string {
  return repoPath("config/ui-catalog");
}

function readJson<T>(rel: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(join(catalogRoot(), rel), "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function listExperiences() {
  const map = readJson<{ experiences?: Record<string, string> }>("access-map.json", {});
  const keys = Object.keys(map.experiences || {});
  return keys.map((key) => ({ key, path: map.experiences![key], brand: "UniLive’s" }));
}

export function listComponents() {
  return [...REGISTERED_COMPONENT_IDS].sort().map((id) => ({ id, selectable: true, remoteCodeAllowed: false }));
}

export function listActions() {
  return [...REGISTERED_ACTION_IDS].sort();
}

export function listBindings() {
  return [...REGISTERED_BINDING_IDS].sort();
}

export function listLayouts() {
  const idx = readJson<{ items?: Array<{ id: string }> }>("catalogs/layouts/index.json", { items: [] });
  return idx.items || [];
}

export function listElements() {
  const idx = readJson<{ items?: Array<{ id: string }> }>("catalogs/elements/index.json", { items: [] });
  return idx.items || [];
}

export function listTranslations() {
  return ["en", "zh-Hans", "zh-Hant", "ja", "ko", "es", "fr", "de", "pt", "ar", "he", "hi", "th", "my"].map((locale) => ({
    locale,
    catalogPath: `artifacts/instacollab/public/i18n/${locale}.json`,
  }));
}

export function listRuntimeDefinitions() {
  return listDefinitions();
}

export function listFeatureFlags() {
  return RUNTIME_CONFIG_INVENTORY.filter((d) => d.classification === "FEATURE_FLAG").map((d) => ({
    id: d.id,
    name: d.name,
    provider: d.provider,
  }));
}
