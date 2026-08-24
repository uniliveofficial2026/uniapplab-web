import { Router, type IRouter, type Request, type Response } from "express";
import { getUniLiveCloud } from "../lib/uniliveCloud";

/**
 * UniLive Cloud control-plane HTTP surface (durable in production).
 * Actor is taken from trusted headers / body for Studio/CLI/MCP bridge.
 * Never returns plaintext secrets — only secretRef metadata.
 */
const router: IRouter = Router();

function actorOf(req: Request): string {
  return String(
    req.header("x-unilive-actor") ||
      req.body?.actorId ||
      req.body?.actor ||
      req.query.actorId ||
      "",
  ).trim();
}

function param(req: Request, key: string): string {
  const value = req.params[key];
  return String(Array.isArray(value) ? value[0] : value || "").trim();
}

function sendErr(res: Response, err: unknown) {
  const e = err as { name?: string; message?: string; status?: number; code?: string; details?: unknown };
  const code = e.code || e.name || "error";
  const status =
    e.status ||
    (code.includes("Permission") || code === "PermissionError"
      ? 403
      : code.includes("NotFound") || code === "NotFoundError"
        ? 404
        : code.includes("Validation") || code === "ValidationError"
          ? 400
          : 500);
  res.status(status).json({ error: code, message: e.message || "request_failed", details: e.details });
}

router.get("/v1/cloud/health", async (_req: Request, res: Response) => {
  const cloud = await getUniLiveCloud();
  res.json({
    ok: true,
    persistenceMode: (cloud as { persistenceMode?: string }).persistenceMode || "memory",
    productionRtcApi: "UniLiveRTC",
    productionMediaProvider: "LiveKit",
  });
});

router.post("/v1/cloud/organizations", async (req: Request, res: Response) => {
  try {
    const cloud = await getUniLiveCloud();
    const name = String(req.body?.name || "").trim();
    const ownerActorId = actorOf(req) || String(req.body?.ownerActorId || "").trim();
    const org = cloud.createOrganization({ name, ownerActorId });
    await cloud.flushDurable?.();
    res.status(201).json({ organization: org });
  } catch (err) {
    sendErr(res, err);
  }
});

router.get("/v1/cloud/organizations/:organizationId/projects", async (req: Request, res: Response) => {
  try {
    const cloud = await getUniLiveCloud();
    const actorId = actorOf(req);
    const projects = cloud.listProjects(param(req, "organizationId"), actorId);
    res.json({ projects });
  } catch (err) {
    sendErr(res, err);
  }
});

router.post("/v1/cloud/organizations/:organizationId/projects", async (req: Request, res: Response) => {
  try {
    const cloud = await getUniLiveCloud();
    const actorId = actorOf(req);
    const name = String(req.body?.name || "").trim() || "project";
    const created = cloud.createProject({
      organizationId: param(req, "organizationId"),
      name,
      actorId,
    });
    await cloud.flushDurable?.();
    res.status(201).json(created);
  } catch (err) {
    sendErr(res, err);
  }
});

router.get("/v1/cloud/projects/:projectId", async (req: Request, res: Response) => {
  try {
    const cloud = await getUniLiveCloud();
    const actorId = actorOf(req);
    const project = cloud.getProject(param(req, "projectId"), actorId);
    const environments = cloud.listEnvironments(param(req, "projectId"), actorId);
    res.json({ project, environments });
  } catch (err) {
    sendErr(res, err);
  }
});

router.get("/v1/cloud/projects/:projectId/environments", async (req: Request, res: Response) => {
  try {
    const cloud = await getUniLiveCloud();
    const actorId = actorOf(req);
    res.json({ environments: cloud.listEnvironments(param(req, "projectId"), actorId) });
  } catch (err) {
    sendErr(res, err);
  }
});

router.get("/v1/cloud/projects/:projectId/audit", async (req: Request, res: Response) => {
  try {
    const cloud = await getUniLiveCloud();
    const actorId = actorOf(req);
    cloud.getProject(param(req, "projectId"), actorId);
    res.json({ audit: cloud.listAudit({ projectId: param(req, "projectId"), limit: 100 }) });
  } catch (err) {
    sendErr(res, err);
  }
});

router.post("/v1/cloud/projects/:projectId/providers", async (req: Request, res: Response) => {
  try {
    const cloud = await getUniLiveCloud();
    const actorId = actorOf(req);
    const row = cloud.connectProvider({
      projectId: param(req, "projectId"),
      environmentId: String(req.body?.environmentId || ""),
      providerType: String(req.body?.providerType || "rtc"),
      actorId,
      capabilities: Array.isArray(req.body?.capabilities) ? req.body.capabilities : ["livekit"],
      secretRef: req.body?.secretRef || null,
    });
    await cloud.flushDurable?.();
    res.status(201).json({ provider: row });
  } catch (err) {
    sendErr(res, err);
  }
});

router.get("/v1/cloud/providers/:providerConnectionId/health", async (req: Request, res: Response) => {
  try {
    const cloud = await getUniLiveCloud();
    const actorId = actorOf(req);
    res.json({ health: cloud.providerHealth(param(req, "providerConnectionId"), actorId) });
  } catch (err) {
    sendErr(res, err);
  }
});

export default router;
