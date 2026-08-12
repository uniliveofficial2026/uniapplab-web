import type { AssetStudioProvider } from './assets.js';

export type JobPhase =
  | 'prepare'
  | 'preview'
  | 'approve'
  | 'validate'
  | 'blocked';

export interface AssetJobRecord {
  jobId: string;
  canonicalId: string;
  provider: AssetStudioProvider;
  phase: JobPhase;
  version: string;
  dryRun: boolean;
  paidCallsUsed: number;
  createdAt: string;
  updatedAt: string;
  draftDir: string;
  referencePaths: string[];
  outputPaths: string[];
  notes: string[];
  blockedReason?: string;
}
