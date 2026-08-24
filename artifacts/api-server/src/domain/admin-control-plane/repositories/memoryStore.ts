import { randomUUID } from "node:crypto";
import type { AdminEnvironment, AdminRole, ChangeSetStatus } from "@workspace/api-zod";

export type AdminUserRoleRow = {
  id: string;
  userId: string;
  role: AdminRole;
  environmentScope: AdminEnvironment | "*";
  resourceScope: string;
  grantedBy: string;
  reason: string;
  startsAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export type ChangeSetRow = {
  id: string;
  changeSetKey: string;
  title: string;
  description: string;
  targetEnvironment: AdminEnvironment;
  status: ChangeSetStatus;
  baseSnapshotId: string;
  baseConfigVersionId: string | null;
  createdBy: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  publishedAt: string | null;
  rolledBackAt: string | null;
  previewSnapshotId: string | null;
  publishedSnapshotId: string | null;
  publishedConfigVersionId: string | null;
  rollbackOfId: string | null;
};

export type ChangeItemRow = {
  id: string;
  changeSetId: string;
  resourceType: string;
  resourceId: string;
  baseVersion: string | null;
  draftVersion: number;
  operation: string;
  patchJson: Record<string, unknown>;
  dependencyJson: Record<string, unknown>;
  validationStatus: "pending" | "valid" | "invalid";
  validationIssues: Array<{ path: string; code: string; message: string }>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ReviewRow = {
  id: string;
  changeSetId: string;
  reviewerUserId: string;
  decision: "approve" | "reject";
  comment: string;
  reviewedRevision: number;
  createdAt: string;
};

export type PublishJobRow = {
  id: string;
  changeSetId: string;
  targetEnvironment: AdminEnvironment;
  idempotencyKey: string;
  status: "queued" | "running" | "succeeded" | "failed" | "rolled_back";
  startedBy: string;
  startedAt: string;
  completedAt: string | null;
  resultSnapshotId: string | null;
  resultConfigVersionId: string | null;
  failureCode: string | null;
  rollbackOfJobId: string | null;
};

export type PreviewSessionRow = {
  id: string;
  changeSetId: string;
  snapshotId: string;
  createdBy: string;
  expiresAt: string;
  createdAt: string;
};

export type AssetQuarantineRow = {
  id: string;
  assetId: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  checksumSha256: string;
  status: "quarantined" | "rejected" | "approved" | "published";
  createdBy: string;
  createdAt: string;
  approvedAt: string | null;
  publicUrl: string | null;
};

export type SessionAssignmentRow = {
  id: string;
  snapshotId: string;
  sessionType: string;
  platform: string;
  applyPolicy: string;
  createdBy: string;
  active: boolean;
  expiresAt: string | null;
  createdAt: string;
};

export type AuditRow = {
  id: string;
  actorUserId: string;
  actorSessionId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  environment: string;
  beforeVersion: string | null;
  afterVersion: string | null;
  changeSetId: string | null;
  requestId: string | null;
  safeMetadata: Record<string, unknown>;
  createdAt: string;
};

const roles: AdminUserRoleRow[] = [];
const changeSets = new Map<string, ChangeSetRow>();
const items = new Map<string, ChangeItemRow>();
const reviews: ReviewRow[] = [];
const jobs = new Map<string, PublishJobRow>();
const idempotency = new Map<string, string>();
const previews: PreviewSessionRow[] = [];
const assets = new Map<string, AssetQuarantineRow>();
const assetBytes = new Map<string, Buffer>();
const assignments: SessionAssignmentRow[] = [];
const audit: AuditRow[] = [];
const contentDrafts = new Map<string, Record<string, unknown>>();
const mediaJobs = new Map<string, Record<string, unknown>>();
const performanceReports = new Map<string, Record<string, unknown>>();
const runtimeBundles = new Map<string, Record<string, unknown>>();
const rollouts = new Map<string, Record<string, unknown>>();
const healthEvents: Array<Record<string, unknown>> = [];

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(): string {
  return randomUUID();
}

export const store = {
  roles,
  changeSets,
  items,
  reviews,
  jobs,
  idempotency,
  previews,
  assets,
  assetBytes,
  assignments,
  audit,
  contentDrafts,
  mediaJobs,
  performanceReports,
  runtimeBundles,
  rollouts,
  healthEvents,
};

export function resetAdminControlPlaneStore(): void {
  roles.length = 0;
  changeSets.clear();
  items.clear();
  reviews.length = 0;
  jobs.clear();
  idempotency.clear();
  previews.length = 0;
  assets.clear();
  assetBytes.clear();
  assignments.length = 0;
  audit.length = 0;
  contentDrafts.clear();
  mediaJobs.clear();
  performanceReports.clear();
  runtimeBundles.clear();
  rollouts.clear();
  healthEvents.length = 0;
}
