import type { PLATFORM_VERSION as ReleaseVersion } from '@unilives/release';

export declare const ROLES: string[];
export declare const ENV_KINDS: string[];
export declare const ROLE_PERMS: Record<string, string[]>;

export declare function createUniLiveCloud(options?: {
  controlPlane?: unknown;
  initialSnapshot?: Record<string, unknown>;
  durable?: Record<string, unknown>;
}): {
  PLATFORM_VERSION: typeof ReleaseVersion | string;
  ROLES: string[];
  persistenceMode: 'durable' | 'memory';
  flushDurable(): Promise<void>;
  createOrganization(input: { name: string; ownerActorId: string }): { organizationId: string; name: string };
  addMember(input: {
    organizationId: string;
    actorId: string;
    role: string;
    byActorId: string;
  }): unknown;
  createProject(input: {
    organizationId: string;
    name: string;
    actorId: string;
  }): { project: { projectId: string; organizationId: string; name: string }; environments: unknown[] };
  getProject(projectId: string, actorId: string): unknown;
  listProjects(organizationId: string, actorId: string): unknown[];
  listEnvironments(projectId: string, actorId: string): unknown[];
  createSecretRef(input: Record<string, unknown>): unknown;
  listSecretMetadata(input: { projectId: string; actorId: string }): unknown[];
  connectProvider(input: Record<string, unknown>): unknown;
  providerHealth(providerConnectionId: string, actorId: string): unknown;
  startDeployment(input: Record<string, unknown>): unknown;
  advanceDeployment(deploymentId: string, status: string, actorId: string): unknown;
  rollbackDeployment(input: { deploymentId: string; actorId: string }): unknown;
  recordUsage(input: Record<string, unknown>): unknown;
  listUsage(projectId: string, actorId: string, opts?: { limit?: number }): unknown[];
  listAudit(opts?: { projectId?: string; organizationId?: string; limit?: number }): unknown[];
  setQuota(kind: string, max: number): void;
  softDeleteProject(input: { projectId: string; actorId: string }): unknown;
};
