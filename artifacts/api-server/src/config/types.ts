export type RuntimeEnvironment = "local" | "test" | "preview" | "staging" | "production";

export type ConfigVersionStatus = "draft" | "validated" | "health_ok" | "published" | "active" | "superseded" | "rolled_back";

export type RuntimeConfigVersion = {
  id: string;
  version: number;
  environment: RuntimeEnvironment;
  status: ConfigVersionStatus;
  checksum: string;
  bindings: Record<string, string>;
  publicValues: Record<string, unknown>;
  immutable: boolean;
  createdAt: string;
  publishedAt?: string;
  activatedAt?: string;
  actor?: string;
  reason?: string;
};

export type AuditRecord = {
  id: string;
  at: string;
  actor: string;
  action: string;
  versionId: string;
  environment: RuntimeEnvironment;
  reason?: string;
  details?: Record<string, unknown>;
};
