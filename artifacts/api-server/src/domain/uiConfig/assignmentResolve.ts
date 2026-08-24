export type UiSessionType = "app" | "anonymous" | "live_room" | "pk" | "admin_preview";
export type ApplyPolicy = "next_session" | "next_screen_entry" | "next_room_join" | "immediate_safe";

export type AssignmentRule = {
  id: string;
  ruleKey: string;
  priority: number;
  scopeType:
    | "admin_preview"
    | "live_room"
    | "pk"
    | "app_session"
    | "authenticated_user"
    | "experiment"
    | "platform"
    | "global";
  snapshotId: string;
  allocationPercentage: number;
  startsAt?: number | null;
  endsAt?: number | null;
  applyPolicy: ApplyPolicy;
  active: boolean;
  conditions: {
    platforms?: string[];
    minAppVersion?: string;
    maxAppVersion?: string;
    regions?: string[];
    segment?: string;
    experimentKey?: string;
    variantKey?: string;
    deviceClass?: string[];
    roomTypes?: string[];
    sessionTypes?: UiSessionType[];
    userIds?: string[];
    anonymousOnly?: boolean;
  };
};

export type AssignmentContext = {
  sessionType: UiSessionType;
  isAdminPreview: boolean;
  userId?: string | null;
  anonymousSessionId?: string | null;
  roomId?: string | null;
  roomType?: string | null;
  pkSessionId?: string | null;
  platform: string;
  appVersion: string;
  deviceClass?: string | null;
  segment?: string | null;
  experimentKey?: string | null;
  region?: string | null;
  reducedMotion?: boolean;
  now?: number;
  explicitSessionSnapshotId?: string | null;
  explicitUserSnapshotId?: string | null;
  previewSnapshotId?: string | null;
};

export type AssignmentDecision = {
  snapshotId: string;
  ruleId: string | null;
  experimentKey: string | null;
  variantKey: string | null;
  applyPolicy: ApplyPolicy;
  source:
    | "admin_preview"
    | "live_room"
    | "pk"
    | "app_session"
    | "authenticated_user"
    | "experiment"
    | "platform"
    | "global"
    | "bundled";
};

export const BUNDLED_SNAPSHOT_ID = "bundled.unilives.v1";

function versionOk(appVersion: string, min?: string, max?: string): boolean {
  if (min && compareSemver(appVersion, min) < 0) return false;
  if (max && compareSemver(appVersion, max) > 0) return false;
  return true;
}

export function compareSemver(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i += 1) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

export function stableBucket(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 100;
}

function matchesRule(rule: AssignmentRule, ctx: AssignmentContext): boolean {
  if (!rule.active) return false;
  const now = ctx.now ?? Date.now();
  if (rule.startsAt && now < rule.startsAt) return false;
  if (rule.endsAt && now > rule.endsAt) return false;
  const c = rule.conditions || {};
  if (c.sessionTypes?.length && !c.sessionTypes.includes(ctx.sessionType)) return false;
  if (c.platforms?.length && !c.platforms.includes(ctx.platform) && !c.platforms.includes("all")) return false;
  if (!versionOk(ctx.appVersion, c.minAppVersion, c.maxAppVersion)) return false;
  if (c.regions?.length && ctx.region && !c.regions.includes(ctx.region)) return false;
  if (c.deviceClass?.length && ctx.deviceClass && !c.deviceClass.includes(ctx.deviceClass)) return false;
  if (c.segment && ctx.segment && c.segment !== ctx.segment) return false;
  if (c.anonymousOnly && ctx.userId) return false;
  if (c.userIds?.length && (!ctx.userId || !c.userIds.includes(ctx.userId))) return false;
  if (c.roomTypes?.length && ctx.roomType && !c.roomTypes.includes(ctx.roomType)) return false;
  if (c.experimentKey && ctx.experimentKey && c.experimentKey !== ctx.experimentKey) return false;
  if (rule.allocationPercentage < 100) {
    const seed = `${ctx.userId || ctx.anonymousSessionId || "anon"}::${c.experimentKey || rule.ruleKey}`;
    if (stableBucket(seed) >= rule.allocationPercentage) return false;
  }
  return true;
}

function pick(rules: AssignmentRule[], scopeType: AssignmentRule["scopeType"], ctx: AssignmentContext): AssignmentRule | null {
  return (
    rules
      .filter((r) => r.scopeType === scopeType && matchesRule(r, ctx))
      .sort((a, b) => a.priority - b.priority || a.ruleKey.localeCompare(b.ruleKey))[0] || null
  );
}

/**
 * Deterministic assignment. Language and reduced-motion are never overridden.
 * UI snapshot cannot grant wallet/live/LiveKit authority.
 */
export function resolveUiAssignment(
  ctx: AssignmentContext,
  rules: AssignmentRule[],
  options?: { compatibleSnapshotIds?: Set<string>; pkCompatibleSnapshotIds?: Set<string> },
): AssignmentDecision {
  const compatible = options?.compatibleSnapshotIds;
  const pkOk = options?.pkCompatibleSnapshotIds;

  const accept = (snapshotId: string): boolean => {
    if (compatible && !compatible.has(snapshotId) && snapshotId !== BUNDLED_SNAPSHOT_ID) return false;
    if (ctx.sessionType === "pk" && pkOk && !pkOk.has(snapshotId) && snapshotId !== BUNDLED_SNAPSHOT_ID) return false;
    if (ctx.roomType?.startsWith("pk") && pkOk && !pkOk.has(snapshotId) && snapshotId !== BUNDLED_SNAPSHOT_ID) return false;
    return true;
  };

  if (ctx.isAdminPreview && ctx.previewSnapshotId && accept(ctx.previewSnapshotId)) {
    return {
      snapshotId: ctx.previewSnapshotId,
      ruleId: pick(rules, "admin_preview", ctx)?.id ?? null,
      experimentKey: null,
      variantKey: null,
      applyPolicy: "next_session",
      source: "admin_preview",
    };
  }

  if ((ctx.sessionType === "live_room" || ctx.roomId) && ctx.explicitSessionSnapshotId && accept(ctx.explicitSessionSnapshotId)) {
    return {
      snapshotId: ctx.explicitSessionSnapshotId,
      ruleId: pick(rules, "live_room", ctx)?.id ?? null,
      experimentKey: null,
      variantKey: null,
      applyPolicy: "next_session",
      source: "live_room",
    };
  }
  const liveRule = ctx.roomId ? pick(rules, "live_room", ctx) : null;
  if (liveRule && accept(liveRule.snapshotId)) {
    return {
      snapshotId: liveRule.snapshotId,
      ruleId: liveRule.id,
      experimentKey: liveRule.conditions.experimentKey ?? null,
      variantKey: liveRule.conditions.variantKey ?? null,
      applyPolicy: liveRule.applyPolicy,
      source: "live_room",
    };
  }

  if ((ctx.sessionType === "pk" || ctx.pkSessionId) && ctx.explicitSessionSnapshotId && accept(ctx.explicitSessionSnapshotId)) {
    return {
      snapshotId: ctx.explicitSessionSnapshotId,
      ruleId: pick(rules, "pk", ctx)?.id ?? null,
      experimentKey: null,
      variantKey: null,
      applyPolicy: "next_session",
      source: "pk",
    };
  }
  const pkRule = ctx.pkSessionId || ctx.sessionType === "pk" ? pick(rules, "pk", ctx) : null;
  if (pkRule && accept(pkRule.snapshotId)) {
    return {
      snapshotId: pkRule.snapshotId,
      ruleId: pkRule.id,
      experimentKey: pkRule.conditions.experimentKey ?? null,
      variantKey: pkRule.conditions.variantKey ?? null,
      applyPolicy: pkRule.applyPolicy,
      source: "pk",
    };
  }

  if (ctx.explicitSessionSnapshotId && accept(ctx.explicitSessionSnapshotId)) {
    return {
      snapshotId: ctx.explicitSessionSnapshotId,
      ruleId: pick(rules, "app_session", ctx)?.id ?? null,
      experimentKey: null,
      variantKey: null,
      applyPolicy: "next_session",
      source: "app_session",
    };
  }
  const appRule = pick(rules, "app_session", ctx);
  if (appRule && accept(appRule.snapshotId)) {
    return {
      snapshotId: appRule.snapshotId,
      ruleId: appRule.id,
      experimentKey: appRule.conditions.experimentKey ?? null,
      variantKey: appRule.conditions.variantKey ?? null,
      applyPolicy: appRule.applyPolicy,
      source: "app_session",
    };
  }

  if (ctx.userId && ctx.explicitUserSnapshotId && accept(ctx.explicitUserSnapshotId)) {
    return {
      snapshotId: ctx.explicitUserSnapshotId,
      ruleId: pick(rules, "authenticated_user", ctx)?.id ?? null,
      experimentKey: null,
      variantKey: null,
      applyPolicy: "next_session",
      source: "authenticated_user",
    };
  }
  const userRule = ctx.userId ? pick(rules, "authenticated_user", ctx) : null;
  if (userRule && accept(userRule.snapshotId)) {
    return {
      snapshotId: userRule.snapshotId,
      ruleId: userRule.id,
      experimentKey: userRule.conditions.experimentKey ?? null,
      variantKey: userRule.conditions.variantKey ?? null,
      applyPolicy: userRule.applyPolicy,
      source: "authenticated_user",
    };
  }

  const expRule = pick(rules, "experiment", ctx);
  if (expRule && accept(expRule.snapshotId)) {
    return {
      snapshotId: expRule.snapshotId,
      ruleId: expRule.id,
      experimentKey: expRule.conditions.experimentKey ?? expRule.ruleKey,
      variantKey: expRule.conditions.variantKey ?? null,
      applyPolicy: expRule.applyPolicy,
      source: "experiment",
    };
  }

  const platformRule = pick(rules, "platform", ctx);
  if (platformRule && accept(platformRule.snapshotId)) {
    return {
      snapshotId: platformRule.snapshotId,
      ruleId: platformRule.id,
      experimentKey: null,
      variantKey: null,
      applyPolicy: platformRule.applyPolicy,
      source: "platform",
    };
  }

  const globalRule = pick(rules, "global", ctx);
  if (globalRule && accept(globalRule.snapshotId)) {
    return {
      snapshotId: globalRule.snapshotId,
      ruleId: globalRule.id,
      experimentKey: null,
      variantKey: null,
      applyPolicy: globalRule.applyPolicy,
      source: "global",
    };
  }

  return {
    snapshotId: BUNDLED_SNAPSHOT_ID,
    ruleId: null,
    experimentKey: null,
    variantKey: null,
    applyPolicy: "next_session",
    source: "bundled",
  };
}

export function ttlMsForSessionType(type: UiSessionType): number {
  switch (type) {
    case "anonymous":
      return 4 * 60 * 60 * 1000;
    case "live_room":
      return 6 * 60 * 60 * 1000;
    case "pk":
      return 2 * 60 * 60 * 1000;
    case "admin_preview":
      return 30 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000;
  }
}

export function publicAssignmentPayload(input: {
  sessionId: string;
  sessionType: UiSessionType;
  snapshotId: string;
  checksum: string;
  lockfile: unknown;
  applyPolicy: ApplyPolicy;
  expiresAt: string;
  source: string;
}): Record<string, unknown> {
  return {
    sessionId: input.sessionId,
    sessionType: input.sessionType,
    snapshotId: input.snapshotId,
    checksum: input.checksum,
    lockfile: input.lockfile,
    applyPolicy: input.applyPolicy,
    expiresAt: input.expiresAt,
    source: input.source,
  };
}
