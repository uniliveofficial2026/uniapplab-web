import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runAutonomousDevAgent, type AutonomousAgentResult } from "./agentPipelineService";
import { runSuperhumanAgent, type SuperhumanAgentResult } from "./agentSupervisorService";
import { type AgentMode } from "./devAgentService";
import { workspacePersistDir } from "./workspaceRuntimeService";

const TASK_DIR = path.join(workspacePersistDir("dev-agent"), "tasks");

export type AgentTask = {
  id: string;
  title: string;
  message: string;
  mode: AgentMode;
  projectId?: string;
  sessionId?: string;
  threadId?: string;
  status: "queued" | "running" | "done" | "failed" | "cancelled";
  result?: SuperhumanAgentResult | null;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
};

let processing = false;
let pendingKick = false;

function taskPath(id: string): string {
  return path.join(TASK_DIR, `${id}.json`);
}

function readTask(id: string): AgentTask | null {
  if (!existsSync(taskPath(id))) return null;
  try {
    return JSON.parse(readFileSync(taskPath(id), "utf8")) as AgentTask;
  } catch {
    return null;
  }
}

function writeTask(task: AgentTask): void {
  mkdirSync(TASK_DIR, { recursive: true });
  writeFileSync(taskPath(task.id), JSON.stringify(task, null, 2));
}

export function listAgentTasks(limit = 30): AgentTask[] {
  if (!existsSync(TASK_DIR)) return [];
  return readdirSync(TASK_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readTask(f.replace(/\.json$/, "")))
    .filter(Boolean)
    .sort((a, b) => String(b!.updatedAt).localeCompare(String(a!.updatedAt)))
    .slice(0, limit) as AgentTask[];
}

export function createAgentTask(input: {
  message: string;
  mode?: AgentMode;
  projectId?: string;
  title?: string;
  sessionId?: string;
  threadId?: string;
  actorId: string;
}): AgentTask {
  const id = createHash("sha256").update(`${input.actorId}:${Date.now()}:${Math.random()}`).digest("hex").slice(0, 12);
  const task: AgentTask = {
    id,
    title: input.title || input.message.slice(0, 64),
    message: input.message.trim(),
    mode: input.mode || "agent",
    projectId: input.projectId,
    sessionId: input.sessionId,
    threadId: input.threadId,
    status: "queued",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  writeTask(task);
  void processTaskQueue(input.actorId);
  return task;
}

async function runTask(taskId: string, actorId: string): Promise<void> {
  const task = readTask(taskId);
  if (!task || task.status !== "queued") return;

  writeTask({ ...task, status: "running", updatedAt: new Date().toISOString() });

  try {
    const result = await runSuperhumanAgent({
      message: task.message,
      mode: task.mode,
      sessionId: task.sessionId,
      context: { projectId: task.projectId },
      actorId,
    });
    const latest = readTask(taskId) || task;
    writeTask({
      ...latest,
      status:
        result.supervisor?.superhuman || result.confidence === "verified" || (result.executed.length > 0 && result.confidence !== "blocked")
          ? "done"
          : "failed",
      sessionId: result.sessionId || latest.sessionId,
      result,
      error:
        result.confidence === "verified" || result.executed.length > 0
          ? null
          : result.blockedReason || result.reply.slice(0, 240),
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    writeTask({
      ...task,
      status: "failed",
      error: e instanceof Error ? e.message : String(e),
      updatedAt: new Date().toISOString(),
    });
  }
}

async function processTaskQueue(actorId: string): Promise<void> {
  if (processing) {
    pendingKick = true;
    return;
  }
  processing = true;
  try {
    do {
      pendingKick = false;
      const queued = listAgentTasks(80).filter((t) => t.status === "queued");
      if (!queued.length) break;
      await Promise.all(queued.slice(0, 4).map((t) => runTask(t.id, actorId)));
    } while (pendingKick || listAgentTasks(80).some((t) => t.status === "queued"));
  } finally {
    processing = false;
  }
  if (listAgentTasks(80).some((t) => t.status === "queued")) void processTaskQueue(actorId);
}

export function cancelAgentTask(id: string): AgentTask | null {
  const task = readTask(id);
  if (!task) return null;
  if (task.status === "queued") {
    writeTask({ ...task, status: "cancelled", updatedAt: new Date().toISOString() });
  }
  return readTask(id);
}

export function getAgentTask(id: string): AgentTask | null {
  return readTask(id);
}
