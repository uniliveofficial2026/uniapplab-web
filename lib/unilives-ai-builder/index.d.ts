export const MAX_REPAIR_ATTEMPTS: number;

export interface ProjectGraphPatchOp {
  op: string;
  params?: Record<string, unknown>;
}

export interface ProjectGraphPatch {
  patchId: string;
  summary: string;
  operations: ProjectGraphPatchOp[];
  requiredPermissions?: string[];
}

export interface ExecutionPlan {
  planId: string;
  requirement: string;
  intent: string;
  patches: ProjectGraphPatch[];
  permissions: string[];
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface AIProvider {
  id: string;
  plan(input: { requirement: string; graph?: unknown }): Promise<ExecutionPlan>;
}

export interface Planner {
  provider: AIProvider;
  planRequirement(requirement: string): Promise<{ plan: ExecutionPlan; validation: ValidationResult }>;
  buildFromRequirement(input: {
    requirement: string;
    projectId?: string;
    name?: string;
    graph?: unknown;
    grantedPermissions?: string[];
  }): Promise<{
    ok: boolean;
    graph: unknown;
    plan?: ExecutionPlan;
    source?: string;
    attempts: number;
    validation: ValidationResult;
  }>;
}

export function sanitizeRequirement(text: string): string;
export function validateExecutionPlan(plan: ExecutionPlan): ValidationResult;
export function validateProjectGraphPatch(patch: ProjectGraphPatch): ValidationResult;
export function applyProjectGraphPatch(
  graph: unknown,
  patch: ProjectGraphPatch,
  ctx?: { grantedPermissions?: string[] },
): unknown;
export function createMockAIProvider(opts?: { id?: string }): AIProvider;
export function createPlanner(options?: {
  provider?: AIProvider;
  grantedPermissions?: string[];
  maxAttempts?: number;
}): Planner;

export function createEmptyProjectGraph(input: { projectId: string; name?: string }): unknown;
export function validateProjectGraph(graph: unknown): true;
export function generateAppSource(graph: unknown): string;
