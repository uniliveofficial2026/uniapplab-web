import { z } from "zod";

export const adminRoleSchema = z.enum([
  "admin_viewer",
  "ui_editor",
  "asset_editor",
  "translation_editor",
  "config_editor",
  "reviewer",
  "publisher",
  "session_manager",
  "secret_operator",
  "security_admin",
  "super_admin",
]);

export const adminPermissionSchema = z.enum([
  "admin.dashboard.read",
  "change_set.read",
  "change_set.create",
  "change_set.edit_own",
  "change_set.submit",
  "change_set.cancel",
  "ui.experience.read",
  "ui.experience.edit",
  "ui.node.edit",
  "ui.component.select",
  "ui.element.edit",
  "ui.layout.edit",
  "ui.theme.edit",
  "ui.token.edit",
  "ui.motion.edit",
  "asset.read",
  "asset.upload",
  "asset.approve",
  "asset.publish",
  "translation.read",
  "translation.edit",
  "translation.review",
  "translation.publish",
  "config.read",
  "config.edit_public",
  "config.edit_private_reference",
  "config.validate",
  "config.activate",
  "session.preview",
  "session.assign",
  "session.end",
  "review.read",
  "review.approve",
  "review.reject",
  "publish.preview",
  "publish.staging",
  "publish.production",
  "publish.rollback",
  "audit.read",
  "access.role.read",
  "access.role.grant",
  "access.role.revoke",
  "secret.metadata.read",
  "secret.reference.edit",
  "secret.write_once",
  "gift.catalog.read",
  "gift.catalog.edit",
  "gift.pricing.edit",
  "gift.pricing.approve",
  "gift.publish",
  "face_effect.read",
  "face_effect.edit",
  "face_effect.approve",
  "face_effect.publish",
  "animation.read",
  "animation.edit",
  "animation.approve",
  "animation.publish",
  "media.upload",
  "media.validate",
  "media.approve",
  "media.publish",
  "performance.read",
  "performance.benchmark",
  "performance.override",
  "rollout.create",
  "rollout.pause",
  "rollout.resume",
  "rollout.rollback",
]);

export const adminEnvironmentSchema = z.enum(["local", "test", "preview", "staging", "production"]);

export const changeSetStatusSchema = z.enum([
  "draft",
  "validating",
  "invalid",
  "valid",
  "preview_ready",
  "pending_review",
  "approved",
  "publishing",
  "published",
  "rejected",
  "cancelled",
  "publish_failed",
  "rolled_back",
  "superseded",
]);

export const changeItemOperationSchema = z.enum(["create", "update", "replace", "archive"]);

export const adminResourceTypeSchema = z.enum([
  "ui.experience",
  "ui.node",
  "ui.component",
  "ui.element",
  "ui.layout",
  "ui.theme",
  "ui.token",
  "ui.token-set",
  "ui.motion",
  "ui.asset",
  "ui.mockup",
  "ui.design",
  "ui.translation",
  "ui.translation-key",
  "ui.translation-catalog",
  "ui.action",
  "ui.data-binding",
  "ui.snapshot",
  "ui.assignment",
  "session.snapshot",
  "session.assignment",
  "session.preset",
  "runtime.config",
  "runtime.secret_reference",
  "runtime.feature_flag",
  "runtime.provider",
  "config.public-runtime",
  "config.private-reference",
  "config.feature-flag",
  "config.provider",
  "config.secret-reference",
  "gift.definition",
  "gift.pricing",
  "face-effect.definition",
  "beauty-effect.definition",
  "animation.pack",
  "effect.renderer",
  "performance.profile",
  "runtime.bundle",
]);

export const createChangeSetRequestSchema = z
  .object({
    title: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    targetEnvironment: adminEnvironmentSchema,
    baseSnapshotId: z.string().min(1),
    baseConfigVersionId: z.string().min(1).optional(),
    reason: z.string().max(500).optional(),
  })
  .strict();

export const patchChangeSetRequestSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    expectedRevision: z.number().int().positive(),
  })
  .strict();

export const upsertChangeItemRequestSchema = z
  .object({
    resourceType: adminResourceTypeSchema,
    resourceId: z.string().min(1).max(200),
    operation: changeItemOperationSchema,
    patch: z.record(z.string(), z.unknown()),
    expectedRevision: z.number().int().positive().optional(),
  })
  .strict();

export const reviewDecisionSchema = z.enum(["approve", "reject"]);

export const reviewRequestSchema = z
  .object({
    decision: reviewDecisionSchema,
    comment: z.string().max(2000).optional(),
    expectedRevision: z.number().int().positive(),
  })
  .strict();

export const publishRequestSchema = z
  .object({
    expectedRevision: z.number().int().positive(),
    idempotencyKey: z.string().min(8).max(128),
    confirmName: z.string().min(1),
    targetEnvironment: adminEnvironmentSchema,
  })
  .strict();

export const rollbackRequestSchema = z
  .object({
    targetPublishedJobId: z.string().min(1).optional(),
    expectedRevision: z.number().int().positive(),
    idempotencyKey: z.string().min(8).max(128),
    confirmName: z.string().min(1),
    reason: z.string().max(500).optional(),
  })
  .strict();

export const grantRoleRequestSchema = z
  .object({
    userId: z.string().min(1).max(80),
    role: adminRoleSchema,
    environmentScope: adminEnvironmentSchema,
    resourceScope: z.string().max(200).optional(),
    reason: z.string().min(1).max(500),
    expiresAt: z.string().datetime().optional(),
  })
  .strict();

export const secretReferenceEditSchema = z
  .object({
    configId: z.string().min(1),
    secretReference: z
      .string()
      .regex(/^(env|supabase-secret|cloudflare-secret|vercel-secret):\/\/[A-Z][A-Z0-9_]*$/),
    expectedRevision: z.number().int().positive().optional(),
  })
  .strict();

export const assetUploadIntentSchema = z
  .object({
    assetId: z.string().min(1).max(200),
    fileName: z.string().min(1).max(200),
    mimeType: z.string().min(1).max(100),
    byteSize: z.number().int().positive().max(50 * 1024 * 1024),
    checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

export const sessionAssignmentRequestSchema = z
  .object({
    snapshotId: z.string().min(1),
    sessionType: z.enum(["anonymous", "app", "live_room", "pk", "admin_preview"]),
    platform: z.string().min(1).max(40).optional(),
    applyPolicy: z.enum(["immediate_safe", "next_session"]).optional(),
    expiresAt: z.string().datetime().optional(),
  })
  .strict();

export type AdminRole = z.infer<typeof adminRoleSchema>;
export type AdminPermission = z.infer<typeof adminPermissionSchema>;
export type AdminEnvironment = z.infer<typeof adminEnvironmentSchema>;
export type ChangeSetStatus = z.infer<typeof changeSetStatusSchema>;
export type AdminResourceType = z.infer<typeof adminResourceTypeSchema>;
