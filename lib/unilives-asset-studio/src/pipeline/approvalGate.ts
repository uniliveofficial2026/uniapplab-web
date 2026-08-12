import { getSafetyConfig } from '../config/env.js';
import type { ApprovalStatus, ProductionStatus } from '../types/assets.js';

export function assertNotAutoProductionApproved(status: ApprovalStatus | ProductionStatus | string) {
  if (status === 'production-approved' || status === 'installed') {
    throw new Error('Asset Studio must never auto-promote to production-approved/installed');
  }
}

export function nextDraftStatuses(): {
  approvalStatus: ApprovalStatus;
  productionStatus: ProductionStatus;
} {
  return { approvalStatus: 'preview-pending', productionStatus: 'draft' };
}

export function nextPreviewStatuses(): {
  approvalStatus: ApprovalStatus;
  productionStatus: ProductionStatus;
} {
  return { approvalStatus: 'preview-pending', productionStatus: 'preview' };
}

export function humanApprovePreviewAllowed(): boolean {
  // approve command records human approval metadata only; still not production-approved
  return getSafetyConfig().requireApproval;
}
