import { Router, type IRouter, type Request, type Response } from "express";
import {
  createControlPlaneStore,
  createProviderRegistry,
  createProjectGraph,
  createRtcUsageMeter,
} from "@unilives/platform-core";
import { createRtcGrant, mintProviderTokenFromGrant, normalizeProviderWebhook } from "@unilives/rtc-server";

/**
 * UniLive Platform API v1 — provider-neutral public contracts.
 * Does not expose Supabase/LiveKit/Cloudflare IDs as product truth.
 */
const controlPlane = createControlPlaneStore();
const registry = createProviderRegistry();
const usageMeter = createRtcUsageMeter();

// Bootstrap a default org/project for local/dev (idempotent process lifetime).
const bootstrapOrg = controlPlane.createOrganization({ name: "unilives-reference", actor: "system" });
const bootstrapProject = controlPlane.createProject({
  organizationId: bootstrapOrg.organizationId,
  name: "uniapplab-web",
  actor: "system",
});

const router: IRouter = Router();

router.get("/v1/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    apiVersion: "v1",
    productionRtcApi: "UniLiveRTC",
    productionMediaProvider: "LiveKit",
  });
});

router.get("/v1/projects", (_req: Request, res: Response) => {
  res.json({ projects: controlPlane.listProjects() });
});

router.post("/v1/projects", (req: Request, res: Response) => {
  const name = String(req.body?.name || "").trim() || "project";
  const organizationId = String(req.body?.organizationId || bootstrapOrg.organizationId);
  const project = controlPlane.createProject({
    organizationId,
    name,
    actor: String(req.body?.actor || "api"),
  });
  res.status(201).json({ project });
});

router.get("/v1/projects/:projectId", (req: Request, res: Response) => {
  const project = controlPlane.getProject(req.params.projectId);
  if (!project) {
    res.status(404).json({ error: "project_not_found" });
    return;
  }
  res.json({
    project,
    environments: controlPlane.listEnvironments(project.projectId),
    graph: createProjectGraph({ projectId: project.projectId, name: project.name }).toJSON(),
  });
});

router.get("/v1/environments", (req: Request, res: Response) => {
  const projectId = String(req.query.projectId || bootstrapProject.projectId);
  res.json({ environments: controlPlane.listEnvironments(projectId) });
});

router.post("/v1/rtc/rooms", (req: Request, res: Response) => {
  const roomId = String(req.body?.roomId || "").trim();
  const roomType = String(req.body?.roomType || "LIVE");
  if (!roomId) {
    res.status(400).json({ error: "roomId_required" });
    return;
  }
  usageMeter.apply({
    eventId: `api-room-${roomId}-${Date.now()}`,
    type: "room_started",
    roomId,
    roomType,
    provider: "livekit",
  });
  controlPlane.recordUsage({ kind: "rtc_room_create", roomId, roomType });
  res.status(201).json({
    room: {
      roomId,
      roomType,
      provider: "livekit",
      resourceId: `room_${roomId}`,
    },
  });
});

router.post("/v1/rtc/tokens", async (req: Request, res: Response) => {
  try {
    const canonicalUserId = String(req.body?.canonicalUserId || "").trim();
    const roomId = String(req.body?.roomId || "").trim();
    const role = (String(req.body?.role || "viewer") as
      | "host"
      | "cohost"
      | "guest"
      | "viewer"
      | "caller"
      | "callee");
    if (!canonicalUserId || !roomId) {
      res.status(400).json({ error: "canonicalUserId_and_roomId_required" });
      return;
    }
    const grant = createRtcGrant({ canonicalUserId, roomId, role });
    try {
      const minted = await mintProviderTokenFromGrant(grant, { roomName: roomId });
      res.json({
        grant: {
          grantId: grant.grantId,
          roomId: grant.roomId,
          role: grant.role,
          permissions: grant.permissions,
          expiresAt: grant.expiresAt,
        },
        provider: minted.provider,
        token: minted.token,
      });
    } catch (err: any) {
      if (err?.code === "PROVIDER_NOT_CONFIGURED") {
        res.status(503).json({
          error: "provider_not_configured",
          grant: {
            grantId: grant.grantId,
            roomId: grant.roomId,
            role: grant.role,
            permissions: grant.permissions,
            expiresAt: grant.expiresAt,
          },
        });
        return;
      }
      throw err;
    }
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "token_failed" });
  }
});

router.post("/v1/rtc/webhooks/normalize", (req: Request, res: Response) => {
  const event = normalizeProviderWebhook({
    provider: String(req.body?.provider || "livekit"),
    providerEventId: String(req.body?.providerEventId || ""),
    type: String(req.body?.type || ""),
    roomId: req.body?.roomId,
    participantIdentity: req.body?.participantIdentity,
    occurredAt: req.body?.occurredAt,
  });
  if (!req.body?.providerEventId) {
    res.status(400).json({ error: "providerEventId_required" });
    return;
  }
  usageMeter.apply({
    eventId: event.eventId,
    type: String(req.body.type || "").replace("room_started", "room_started"),
    roomId: event.roomId,
    provider: String(req.body.provider || "livekit"),
    canonicalUserId: event.canonicalUserId,
  });
  res.json({ event });
});

router.get("/v1/storage/buckets", (_req: Request, res: Response) => {
  res.json({
    buckets: [],
    provider: registry.resolve("storage")?.provider || "cloudflare-r2",
    note: "Use UniLive storage boundary; provider bucket names stay in mappings",
  });
});

router.get("/v1/deployments", (_req: Request, res: Response) => {
  res.json({ deployments: controlPlane.listUsage({ limit: 20 }).filter((u: any) => u.kind === "deployment") });
});

router.post("/v1/deployments", (req: Request, res: Response) => {
  const projectId = String(req.body?.projectId || bootstrapProject.projectId);
  const envs = controlPlane.listEnvironments(projectId);
  const environmentId = String(req.body?.environmentId || envs[0]?.environmentId || "");
  const gitSha = String(req.body?.gitSha || "").trim();
  if (!gitSha || !environmentId) {
    res.status(400).json({ error: "gitSha_and_environmentId_required" });
    return;
  }
  const deployment = controlPlane.startDeployment({
    projectId,
    environmentId,
    gitSha,
    actor: String(req.body?.actor || "api"),
  });
  res.status(201).json({ deployment });
});

router.get("/v1/logs", (req: Request, res: Response) => {
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  res.json({ logs: controlPlane.listAudit({ limit }) });
});

router.get("/v1/metrics", (_req: Request, res: Response) => {
  res.json({
    rtc: usageMeter.rollup(),
    providers: registry.list().map((p: { kind: string; provider: string; status: string }) => ({
      kind: p.kind,
      provider: p.provider,
      status: p.status,
    })),
  });
});

router.get("/v1/providers", (_req: Request, res: Response) => {
  res.json({ providers: registry.list() });
});

export default router;
export { controlPlane as uniliveControlPlane, bootstrapProject as uniliveBootstrapProject };
