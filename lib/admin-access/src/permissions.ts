import type { AdminResourceType } from "./resourceTypes";

const READ: Record<string, string> = {
  "ui.experience": "ui.experience.read",
  "ui.node": "ui.experience.read",
  "ui.component": "ui.experience.read",
  "ui.element": "ui.experience.read",
  "ui.layout": "ui.experience.read",
  "ui.theme": "ui.experience.read",
  "ui.token-set": "ui.experience.read",
  "ui.asset": "asset.read",
  "ui.motion": "ui.experience.read",
  "ui.mockup": "ui.experience.read",
  "ui.design": "ui.experience.read",
  "ui.translation-key": "translation.read",
  "ui.translation-catalog": "translation.read",
  "ui.action": "ui.experience.read",
  "ui.data-binding": "ui.experience.read",
  "session.snapshot": "session.preview",
  "session.assignment": "session.assign",
  "session.preset": "session.preview",
  "config.public-runtime": "config.read",
  "config.private-reference": "config.read",
  "config.feature-flag": "config.read",
  "config.provider": "config.read",
  "config.secret-reference": "secret.metadata.read",
  "gift.definition": "gift.catalog.read",
  "gift.pricing": "gift.pricing.edit",
  "face-effect.definition": "face_effect.read",
  "beauty-effect.definition": "face_effect.read",
  "animation.pack": "animation.read",
  "effect.renderer": "performance.read",
  "performance.profile": "performance.read",
  "runtime.bundle": "performance.read",
  "pipeline.definition": "admin.dashboard.read",
  "permission.definition": "access.role.read",
  "fallback.definition": "ui.experience.read",
};

const EDIT: Record<string, string | null> = {
  "ui.experience": "ui.experience.edit",
  "ui.node": "ui.node.edit",
  "ui.component": "ui.component.select",
  "ui.element": "ui.element.edit",
  "ui.layout": "ui.layout.edit",
  "ui.theme": "ui.theme.edit",
  "ui.token-set": "ui.token.edit",
  "ui.asset": "asset.upload",
  "ui.motion": "ui.motion.edit",
  "ui.mockup": "ui.experience.edit",
  "ui.design": "ui.experience.edit",
  "ui.translation-key": "translation.edit",
  "ui.translation-catalog": "translation.edit",
  "ui.action": null,
  "ui.data-binding": null,
  "session.snapshot": "session.preview",
  "session.assignment": "session.assign",
  "session.preset": "session.assign",
  "config.public-runtime": "config.edit_public",
  "config.private-reference": "config.edit_private_reference",
  "config.feature-flag": "config.edit_public",
  "config.provider": "config.edit_private_reference",
  "config.secret-reference": "secret.reference.edit",
  "gift.definition": "gift.catalog.edit",
  "gift.pricing": "gift.pricing.edit",
  "face-effect.definition": "face_effect.edit",
  "beauty-effect.definition": "face_effect.edit",
  "animation.pack": "animation.edit",
  "effect.renderer": null,
  "performance.profile": "performance.benchmark",
  "runtime.bundle": "rollout.create",
  "pipeline.definition": null,
  "permission.definition": null,
  "fallback.definition": null,
};

export function readPermissionForType(type: AdminResourceType | string): string {
  return READ[type] || "admin.dashboard.read";
}

export function editPermissionForType(type: AdminResourceType | string): string | null {
  return Object.prototype.hasOwnProperty.call(EDIT, type) ? EDIT[type] : "change_set.edit_own";
}

export function isReadOnlyType(type: string): boolean {
  return editPermissionForType(type) == null;
}
