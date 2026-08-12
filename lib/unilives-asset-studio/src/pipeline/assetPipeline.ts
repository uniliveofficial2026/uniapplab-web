import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getSafetyConfig } from '../config/env.js';
import type { AssetStudioProvider } from '../types/assets.js';
import type { AssetJobRecord } from '../types/jobs.js';
import { nextDraftStatuses, nextPreviewStatuses } from './approvalGate.js';
import { sharedBudgetGuard } from './budgetGuard.js';
import { findManifestEntry, updateManifestEntry } from './manifestUpdater.js';
import { appendJobIndex, ensureDraftDir, writeJobMetadata } from './outputWriter.js';
import { resolveReferencesForAsset } from './referenceResolver.js';

function nowVersion(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `v${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
}

export function prepareAsset(canonicalId: string): AssetJobRecord {
  const entry = findManifestEntry(canonicalId);
  if (!entry) {
    throw new Error(`Canonical ID not found in authoritative manifest: ${canonicalId}`);
  }
  const refs = resolveReferencesForAsset(entry);
  const version = nowVersion();
  const draftDir = ensureDraftDir(canonicalId, version);
  const job: AssetJobRecord = {
    jobId: randomUUID(),
    canonicalId,
    provider: 'local',
    phase: refs.ok ? 'prepare' : 'blocked',
    version,
    dryRun: getSafetyConfig().dryRun,
    paidCallsUsed: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    draftDir,
    referencePaths: refs.referencePaths,
    outputPaths: [],
    notes: [
      ...refs.notes,
      ...(refs.boardRejected.length
        ? [`Rejected board-like paths: ${refs.boardRejected.join(', ')}`]
        : []),
      ...(refs.missing.length
        ? [`Missing candidate references (not all required): ${refs.missing.slice(0, 8).join(', ')}`]
        : []),
    ],
    blockedReason: refs.ok
      ? undefined
      : 'Physical approved individual reference required before generation',
  };

  writeFileSync(join(draftDir, 'prepare-report.json'), JSON.stringify({ refs, job }, null, 2) + '\n');
  writeJobMetadata(job);
  appendJobIndex(job);

  if (refs.ok) {
    const statuses = nextDraftStatuses();
    updateManifestEntry(canonicalId, {
      ...statuses,
      sourceReferencePath: refs.referencePaths[0] ?? entry.sourceReferencePath,
      notes: `Asset Studio prepare ${version}: draft folder ready (dryRun=${job.dryRun})`,
    });
  }

  return job;
}

export function previewAsset(canonicalId: string, provider: AssetStudioProvider): AssetJobRecord {
  const entry = findManifestEntry(canonicalId);
  if (!entry) throw new Error(`Unknown canonical ID: ${canonicalId}`);

  const prepared = prepareAsset(canonicalId);
  if (prepared.phase === 'blocked') return prepared;

  const safety = getSafetyConfig();
  const budget = sharedBudgetGuard.tryConsumePaidCall();

  const job: AssetJobRecord = {
    ...prepared,
    jobId: randomUUID(),
    provider,
    phase: 'preview',
    updatedAt: new Date().toISOString(),
    paidCallsUsed: sharedBudgetGuard.used,
    notes: [
      ...prepared.notes,
      `provider=${provider}`,
      `dryRun=${safety.dryRun}`,
      budget.allowed
        ? 'Paid call authorized (1 max)'
        : `Paid call blocked: ${budget.reason}`,
    ],
  };

  if (!budget.allowed) {
    job.phase = 'preview';
    job.blockedReason = budget.reason;
    writeFileSync(
      join(job.draftDir, 'preview-dry-run.json'),
      JSON.stringify(
        {
          message: 'Dry-run / budget gate: no paid provider called',
          provider,
          canonicalId,
          plannedOutputs: {
            master: join(job.draftDir, 'masters', `${canonicalId}.png`),
            previewMp4: join(job.draftDir, 'previews', `${canonicalId}.mp4`),
            previewWebm: join(job.draftDir, 'previews', `${canonicalId}.webm`),
            audio: join(job.draftDir, 'audio', `${canonicalId}.mp3`),
            reducedMotion: join(job.draftDir, 'runtime', `${canonicalId}.reduced.png`),
          },
          budget: sharedBudgetGuard.snapshot(),
        },
        null,
        2,
      ) + '\n',
    );
    writeJobMetadata(job);
    appendJobIndex(job);
    // Keep draft status — do not claim preview media exists
    const statuses = nextDraftStatuses();
    updateManifestEntry(canonicalId, {
      ...statuses,
      notes: `Asset Studio preview dry-run ${job.version}: ${budget.reason}`,
    });
    return job;
  }

  // Paid path is intentionally narrow and provider-specific; construction phase never reaches here
  // while ASSET_STUDIO_DRY_RUN=true.
  throw new Error(
    'Paid preview path is gated. Set ASSET_STUDIO_DRY_RUN=false explicitly for one call, then restore true.',
  );
}

export function approveAssetPreview(canonicalId: string, version: string): AssetJobRecord {
  const entry = findManifestEntry(canonicalId);
  if (!entry) throw new Error(`Unknown canonical ID: ${canonicalId}`);
  const draftDir = ensureDraftDir(canonicalId, version);
  const job: AssetJobRecord = {
    jobId: randomUUID(),
    canonicalId,
    provider: 'local',
    phase: 'approve',
    version,
    dryRun: getSafetyConfig().dryRun,
    paidCallsUsed: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    draftDir,
    referencePaths: [],
    outputPaths: [],
    notes: [
      'Human approval recorded for preview only',
      'Not production-approved',
      'Not deployed',
    ],
  };
  writeJobMetadata(job);
  appendJobIndex(job);
  // preview-approved is allowed as human gate; still not production-approved
  updateManifestEntry(canonicalId, {
    approvalStatus: 'preview-approved',
    productionStatus: 'preview',
    notes: `Human preview approval recorded for ${version} — not production-approved`,
  });
  return job;
}
