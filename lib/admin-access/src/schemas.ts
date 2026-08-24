import { z } from "zod";
import { ADMIN_RESOURCE_TYPES } from "./resourceTypes";

export const adminAccessResourceTypeSchema = z.enum(ADMIN_RESOURCE_TYPES);

export const resourceReferenceSchema = z.object({
  type: z.string().min(1),
  id: z.string().min(1),
  note: z.string().optional(),
});

export const adminAccessibleResourceSchema = z.object({
  resourceId: z.string().min(1),
  resourceType: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  ownerDomain: z.string().min(1),
  sourceRegistry: z.string().min(1),
  currentPublishedVersion: z.number(),
  draftVersion: z.number().nullable().optional(),
  schemaId: z.string().min(1),
  editorId: z.string().min(1),
  pipelineId: z.string().min(1),
  requiredPermission: z.string().min(1),
  dependencies: z.array(resourceReferenceSchema),
  consumers: z.array(z.object({ id: z.string(), type: z.string().optional() })),
  previewExperienceIds: z.array(z.string()),
  fallbackResourceId: z.string().nullable().optional(),
  runtimeChangeable: z.boolean(),
  requiresFrontendRelease: z.boolean(),
  requiresBackendRelease: z.boolean(),
  requiresNativeRelease: z.boolean(),
  status: z.enum(["active", "deprecated", "archived"]),
});

export const createResourceDraftSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    targetEnvironment: z.enum(["local", "test", "preview", "staging", "production"]).optional(),
    patch: z.record(z.string(), z.unknown()).optional(),
    operation: z.enum(["create", "update", "replace", "archive"]).optional(),
  })
  .strict();
