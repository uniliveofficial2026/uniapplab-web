import { Router, type IRouter } from "express";
import { requirePermission } from "../../middlewares/requirePermission";
import { isDevWorkspaceEnabled } from "../../domain/admin-control-plane/workspaceConfigService";
import {
  devAgentChat,
  listDevAgentSessions,
  readDevAgentSession,
  stageMicroEdit,
  type AgentMode,
} from "../../domain/admin-control-plane/devAgentService";
import { runSuperhumanAgent } from "../../domain/admin-control-plane/agentSupervisorService";
import { listMemory, getMemoryStats } from "../../domain/admin-control-plane/workspaceMemoryService";
import { scanProjectHealth } from "../../domain/admin-control-plane/agentProactiveService";
import { getOmniCatalog, runOmniCapability } from "../../domain/admin-control-plane/omniStudioService";
import {
  getProviderJob,
  listProviderHealth,
  runProviderAction,
} from "../../domain/admin-control-plane/providerIntegrationService";
import { envAutopilotSummary } from "../../domain/admin-control-plane/envProviderCatalog";
import { localEngineSummary } from "../../domain/admin-control-plane/localWorkService";
import {
  cancelAgentTask,
  createAgentTask,
  getAgentTask,
  listAgentTasks,
} from "../../domain/admin-control-plane/agentTaskService";
import {
  implementUniversalBatch,
  readUniversalImplementResult,
  convertUniversalInput,
} from "../../domain/admin-control-plane/universalImplementService";
import { detectWorkspaceProject, registerCustomApp, scanArtifactsForApps } from "../../domain/admin-control-plane/projectRegistryService";
import { scaffoldAppStructure } from "../../domain/admin-control-plane/appStructureScaffoldService";
import { executeTerminalCommand, parseTerminalCommand, validateTerminalCommand } from "../../domain/admin-control-plane/localTerminalService";
import {
  ENV_QUICK_PRESETS,
  readLocalEnvFile,
  upsertLocalEnvEntries,
  writeLocalEnvContent,
} from "../../domain/admin-control-plane/localEnvFileService";
import { isLocalFilesystemWorkspace } from "../../domain/admin-control-plane/workspaceRuntimeService";
import { listWorkspacePorts } from "../../domain/admin-control-plane/localPortsService";
import {
  applyLocalMcpToCursor,
  MCP_PRESETS,
  readMcpConfig,
  readMcpConfigSources,
  removeMcpServer,
  upsertMcpServer,
  writeLocalMcpConfig,
} from "../../domain/admin-control-plane/mcpConfigService";
import { apiError } from "../../lib/apiError";

const router: IRouter = Router();

function workspaceGate(_req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  if (!isDevWorkspaceEnabled()) {
    apiError(res, 404, "error.notFound");
    return;
  }
  next();
}

router.post("/chat", requirePermission("ui.experience.edit"), workspaceGate, async (req, res, next) => {
  try {
    const body = req.body as {
      message?: string;
      context?: Record<string, unknown>;
      sessionId?: string;
      mode?: string;
    };
    const message = String(body.message || "").trim();
    if (!message) {
      apiError(res, 400, "agent.invalid");
      return;
    }
    const mode = (body.mode as AgentMode) || "agent";
    const context = body.context as import("../../domain/admin-control-plane/devAgentService").DevAgentContext;
    const result =
      mode === "agent" || mode === "debug"
        ? await runSuperhumanAgent({
            message,
            context,
            sessionId: body.sessionId,
            mode,
            actorId: req.adminAuthz!.userId,
          })
        : await devAgentChat({
            message,
            context,
            sessionId: body.sessionId,
            mode,
            actorId: req.adminAuthz!.userId,
          });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.post("/micro-edit", requirePermission("ui.experience.edit"), workspaceGate, (req, res, next) => {
  try {
    const body = req.body as {
      resourceId?: string;
      resourceType?: string;
      patch?: Record<string, unknown>;
      changeSetId?: string | null;
      title?: string;
      note?: string;
    };
    if (!body.resourceId || !body.patch) {
      apiError(res, 400, "agent.invalid");
      return;
    }
    const result = stageMicroEdit(
      {
        resourceId: String(body.resourceId),
        resourceType: body.resourceType,
        patch: body.patch,
        changeSetId: body.changeSetId,
        title: body.title,
        note: body.note,
      },
      req.adminAuthz!.userId,
    );
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.get("/sessions", requirePermission("ui.experience.read"), workspaceGate, (_req, res, next) => {
  try {
    res.json({ items: listDevAgentSessions() });
  } catch (e) {
    next(e);
  }
});

router.get("/sessions/:id", requirePermission("ui.experience.read"), workspaceGate, (req, res, next) => {
  try {
    res.json({ id: req.params.id, messages: readDevAgentSession(String(req.params.id)) });
  } catch (e) {
    next(e);
  }
});

router.get("/projects", requirePermission("ui.experience.read"), workspaceGate, (_req, res) => {
  res.json({ items: scanArtifactsForApps() });
});

router.get("/detect", requirePermission("ui.experience.read"), workspaceGate, (req, res, next) => {
  try {
    if (!isLocalFilesystemWorkspace()) {
      apiError(res, 403, "terminal.localOnly");
      return;
    }
    const projectId = String(req.query.projectId || "").trim();
    res.json(detectWorkspaceProject(projectId || undefined));
  } catch (e) {
    next(e);
  }
});

router.post("/projects", requirePermission("ui.experience.edit"), workspaceGate, (req, res, next) => {
  try {
    const body = req.body as { id?: string; name?: string; path?: string; previewPath?: string };
    if (!body.id || !body.name || !body.path) {
      apiError(res, 400, "agent.invalid");
      return;
    }
    res.json({
      items: registerCustomApp({
        id: String(body.id),
        name: String(body.name),
        path: String(body.path),
        previewPath: body.previewPath,
      }),
    });
  } catch (e) {
    next(e);
  }
});

router.post("/scaffold-app", requirePermission("ui.experience.edit"), workspaceGate, (req, res, next) => {
  try {
    const body = req.body as { message?: string; appName?: string; appId?: string; changeSetId?: string | null; projectId?: string | null };
    const message = String(body.message || body.appName || "create app").trim();
    const result = scaffoldAppStructure({
      message,
      appName: body.appName,
      appId: body.appId,
      actorId: req.adminAuthz!.userId,
      changeSetId: body.changeSetId,
      projectId: body.projectId,
    });
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
});

router.post("/terminal", requirePermission("ui.experience.edit"), workspaceGate, async (req, res, next) => {
  try {
    if (!isLocalFilesystemWorkspace()) {
      apiError(res, 403, "terminal.localOnly");
      return;
    }
    const body = req.body as { command?: string; cwd?: string; projectId?: string; timeoutMs?: number };
    const command = String(body.command || "").trim();
    if (!command) {
      apiError(res, 400, "terminal.invalid");
      return;
    }
    const validation = validateTerminalCommand(command);
    if (!validation.ok) {
      res.status(403).json({ code: "terminal.blocked", reason: validation.reason, command });
      return;
    }
    const parsed = parseTerminalCommand(command) || { command };
    const result = await executeTerminalCommand({
      command: parsed.command,
      cwd: body.cwd,
      projectId: body.projectId,
      timeoutMs: body.timeoutMs,
    });
    res.json(result);
  } catch (e) {
    next(e);
  }
});

router.get("/ports", requirePermission("ui.experience.read"), workspaceGate, async (_req, res, next) => {
  try {
    const items = await listWorkspacePorts();
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

router.get("/env", requirePermission("ui.experience.read"), workspaceGate, (_req, res, next) => {
  try {
    if (!isLocalFilesystemWorkspace()) {
      apiError(res, 403, "env.localOnly");
      return;
    }
    const file = readLocalEnvFile();
    res.json({ ...file, presets: ENV_QUICK_PRESETS });
  } catch (e) {
    next(e);
  }
});

router.patch("/env", requirePermission("ui.experience.edit"), workspaceGate, (req, res, next) => {
  try {
    if (!isLocalFilesystemWorkspace()) {
      apiError(res, 403, "env.localOnly");
      return;
    }
    const body = req.body as { entries?: Record<string, string> };
    const entries = body.entries || {};
    if (!Object.keys(entries).length) {
      apiError(res, 400, "env.invalid");
      return;
    }
    res.json(upsertLocalEnvEntries(entries));
  } catch (e) {
    next(e);
  }
});

router.put("/env", requirePermission("ui.experience.edit"), workspaceGate, (req, res, next) => {
  try {
    if (!isLocalFilesystemWorkspace()) {
      apiError(res, 403, "env.localOnly");
      return;
    }
    const body = req.body as { content?: string };
    const content = String(body.content ?? "");
    res.json(writeLocalEnvContent(content));
  } catch (e) {
    next(e);
  }
});

router.get("/tasks", requirePermission("ui.experience.read"), workspaceGate, (_req, res) => {
  res.json({ items: listAgentTasks() });
});

router.get("/tasks/:id", requirePermission("ui.experience.read"), workspaceGate, (req, res, next) => {
  try {
    const task = getAgentTask(String(req.params.id));
    if (!task) {
      apiError(res, 404, "error.notFound");
      return;
    }
    res.json(task);
  } catch (e) {
    next(e);
  }
});

router.post("/tasks", requirePermission("ui.experience.edit"), workspaceGate, (req, res, next) => {
  try {
    const body = req.body as {
      message?: string;
      mode?: string;
      projectId?: string;
      title?: string;
      sessionId?: string;
      threadId?: string;
    };
    const message = String(body.message || "").trim();
    if (!message) {
      apiError(res, 400, "agent.invalid");
      return;
    }
    const task = createAgentTask({
      message,
      mode: (body.mode as import("../../domain/admin-control-plane/devAgentService").AgentMode) || "agent",
      projectId: body.projectId,
      title: body.title,
      sessionId: body.sessionId,
      threadId: body.threadId,
      actorId: req.adminAuthz!.userId,
    });
    res.status(201).json(task);
  } catch (e) {
    next(e);
  }
});

router.post("/tasks/:id/cancel", requirePermission("ui.experience.edit"), workspaceGate, (req, res, next) => {
  try {
    const task = cancelAgentTask(String(req.params.id));
    if (!task) {
      apiError(res, 404, "error.notFound");
      return;
    }
    res.json(task);
  } catch (e) {
    next(e);
  }
});

router.get("/mcp", requirePermission("ui.experience.read"), workspaceGate, (_req, res, next) => {
  try {
    res.json({ ...readMcpConfigSources(), presets: MCP_PRESETS });
  } catch (e) {
    next(e);
  }
});

router.put("/mcp", requirePermission("ui.experience.edit"), workspaceGate, (req, res, next) => {
  try {
    const body = req.body as { mcpServers?: Record<string, unknown> };
    if (!body.mcpServers) {
      apiError(res, 400, "agent.invalid");
      return;
    }
    const saved = writeLocalMcpConfig({ mcpServers: body.mcpServers as Record<string, import("../../domain/admin-control-plane/mcpConfigService").McpServerConfig> });
    res.json(saved);
  } catch (e) {
    next(e);
  }
});

router.post("/mcp/servers", requirePermission("ui.experience.edit"), workspaceGate, (req, res, next) => {
  try {
    const body = req.body as { serverId?: string; config?: Record<string, unknown>; applyToCursor?: boolean };
    if (!body.serverId || !body.config) {
      apiError(res, 400, "agent.invalid");
      return;
    }
    const merged = upsertMcpServer(
      String(body.serverId),
      body.config as import("../../domain/admin-control-plane/mcpConfigService").McpServerConfig,
      Boolean(body.applyToCursor),
    );
    res.json(merged);
  } catch (e) {
    next(e);
  }
});

router.delete("/mcp/servers/:id", requirePermission("ui.experience.edit"), workspaceGate, (req, res, next) => {
  try {
    const applyToCursor = String(req.query.applyToCursor || "") === "1";
    res.json(removeMcpServer(String(req.params.id), applyToCursor));
  } catch (e) {
    next(e);
  }
});

router.post("/implement", requirePermission("ui.experience.edit"), workspaceGate, async (req, res, next) => {
  try {
    const body = req.body as {
      files?: Array<{
        fileName?: string;
        mimeType?: string;
        dataBase64?: string;
      }>;
      targetResourceId?: string | null;
      targetResourceType?: string | null;
      screenName?: string;
      pickLabel?: string | null;
      projectId?: string;
      changeSetId?: string | null;
    };
    const files = body.files || [];
    if (!files.length) {
      apiError(res, 400, "implement.invalid");
      return;
    }
    const batch = await implementUniversalBatch(
      files
        .filter((f) => f.fileName && f.dataBase64)
        .map((f) => ({
          fileName: String(f.fileName),
          mimeType: String(f.mimeType || "application/octet-stream"),
          dataBase64: String(f.dataBase64),
          targetResourceId: body.targetResourceId,
          targetResourceType: body.targetResourceType,
          screenName: body.screenName,
          pickLabel: body.pickLabel,
          projectId: body.projectId,
          changeSetId: body.changeSetId,
          actorId: req.adminAuthz!.userId,
        })),
    );
    res.status(201).json(batch);
  } catch (e) {
    next(e);
  }
});

router.get("/implement/:id", requirePermission("ui.experience.read"), workspaceGate, (req, res, next) => {
  try {
    const item = readUniversalImplementResult(String(req.params.id));
    if (!item) {
      apiError(res, 404, "error.notFound");
      return;
    }
    res.json(item);
  } catch (e) {
    next(e);
  }
});

router.post("/convert", requirePermission("ui.experience.edit"), workspaceGate, async (req, res, next) => {
  try {
    const body = req.body as {
      fileName?: string;
      mimeType?: string;
      dataBase64?: string;
      targetResourceId?: string | null;
      changeSetId?: string | null;
      projectId?: string;
    };
    if (!body.fileName || !body.dataBase64) {
      apiError(res, 400, "convert.invalid");
      return;
    }
    const result = await convertUniversalInput({
      fileName: String(body.fileName),
      mimeType: String(body.mimeType || "text/plain"),
      dataBase64: String(body.dataBase64),
      targetResourceId: body.targetResourceId,
      changeSetId: body.changeSetId,
      projectId: body.projectId,
      actorId: req.adminAuthz!.userId,
    });
    res.status(201).json(result);
  } catch (e) {
    next(e);
  }
});

router.post("/mcp/apply-cursor", requirePermission("ui.experience.edit"), workspaceGate, (_req, res, next) => {
  try {
    res.json(applyLocalMcpToCursor());
  } catch (e) {
    next(e);
  }
});

router.get("/memory", requirePermission("ui.experience.read"), workspaceGate, (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "instacollab");
    res.json({ stats: getMemoryStats(projectId), items: listMemory(projectId, 40) });
  } catch (e) {
    next(e);
  }
});

router.get("/proactive", requirePermission("ui.experience.read"), workspaceGate, async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "instacollab");
    const insights = await scanProjectHealth(projectId);
    res.json({ projectId, insights });
  } catch (e) {
    next(e);
  }
});

router.get("/omni/catalog", requirePermission("ui.experience.read"), workspaceGate, (_req, res, next) => {
  try {
    res.json(getOmniCatalog());
  } catch (e) {
    next(e);
  }
});

router.post("/omni/run", requirePermission("ui.experience.edit"), workspaceGate, async (req, res, next) => {
  try {
    const body = req.body as {
      capabilityId?: string;
      message?: string;
      files?: Array<{ fileName: string; mimeType: string; dataBase64: string }>;
      context?: Record<string, unknown>;
      sessionId?: string;
    };
    if (!body.capabilityId) {
      apiError(res, 400, "omni.invalid");
      return;
    }
    const result = await runOmniCapability({
      capabilityId: String(body.capabilityId),
      message: body.message,
      files: body.files,
      context: body.context as import("../../domain/admin-control-plane/devAgentService").DevAgentContext,
      sessionId: body.sessionId,
      actorId: req.adminAuthz!.userId,
    });
    res.status(result.status === "pending" ? 202 : 201).json(result);
  } catch (e) {
    next(e);
  }
});

router.get("/providers", requirePermission("ui.experience.read"), workspaceGate, async (_req, res, next) => {
  try {
    const providers = await listProviderHealth();
    res.json({ providers, autopilot: envAutopilotSummary(), localEngine: localEngineSummary() });
  } catch (e) {
    next(e);
  }
});

router.get("/providers/jobs/:jobId", requirePermission("ui.experience.read"), workspaceGate, (req, res, next) => {
  try {
    const job = getProviderJob(String(req.params.jobId || ""));
    if (!job) {
      apiError(res, 404, "error.notFound");
      return;
    }
    res.json({ job });
  } catch (e) {
    next(e);
  }
});

router.post("/providers/run", requirePermission("ui.experience.edit"), workspaceGate, async (req, res, next) => {
  try {
    const body = req.body as {
      providerId?: string;
      actionId?: string;
      prompt?: string;
      params?: Record<string, unknown>;
      files?: Array<{ fileName: string; mimeType: string; dataBase64: string }>;
      context?: Record<string, unknown>;
    };
    if (!body.providerId || !body.actionId) {
      apiError(res, 400, "provider.invalid");
      return;
    }
    const result = await runProviderAction({
      providerId: String(body.providerId),
      actionId: String(body.actionId),
      prompt: body.prompt,
      params: body.params,
      files: body.files,
      context: body.context as import("../../domain/admin-control-plane/providerIntegrationService").ProviderRunInput["context"],
      actorId: req.adminAuthz!.userId,
    });
    res.status(result.status === "pending" ? 202 : 201).json(result);
  } catch (e) {
    next(e);
  }
});

export default router;
