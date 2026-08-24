const EDITORS: Record<string, string> = {
  "ui.experience": "editor.ui-experience",
  "ui.node": "editor.ui-node",
  "ui.component": "editor.component-selector",
  "ui.element": "editor.element",
  "ui.layout": "editor.layout",
  "ui.theme": "editor.theme",
  "ui.token-set": "editor.token-set",
  "ui.asset": "editor.asset",
  "ui.motion": "editor.motion",
  "ui.mockup": "editor.mockup",
  "ui.design": "editor.design",
  "ui.translation-key": "editor.translation",
  "ui.translation-catalog": "editor.translation-catalog",
  "ui.action": "editor.read-only",
  "ui.data-binding": "editor.read-only",
  "session.snapshot": "editor.snapshot",
  "session.assignment": "editor.assignment",
  "session.preset": "editor.assignment",
  "config.public-runtime": "editor.runtime-config",
  "config.private-reference": "editor.runtime-config",
  "config.feature-flag": "editor.feature-flag",
  "config.provider": "editor.provider",
  "config.secret-reference": "editor.secret-reference",
  "gift.definition": "editor.gift",
  "gift.pricing": "editor.gift-pricing",
  "face-effect.definition": "editor.face-effect",
  "beauty-effect.definition": "editor.beauty-effect",
  "animation.pack": "editor.animation",
  "effect.renderer": "editor.read-only",
  "performance.profile": "editor.performance",
  "runtime.bundle": "editor.runtime-bundle",
  "pipeline.definition": "editor.read-only",
  "permission.definition": "editor.read-only",
  "fallback.definition": "editor.read-only",
};

export function editorForType(type: string): string {
  return EDITORS[type] || "editor.read-only";
}

export function isUnknownTypeReadOnly(type: string): boolean {
  return !EDITORS[type] || EDITORS[type] === "editor.read-only";
}
