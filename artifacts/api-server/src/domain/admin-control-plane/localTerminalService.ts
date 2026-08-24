import { spawn } from "node:child_process";
import path from "node:path";
import { repoPath } from "../../lib/repoRoot";
import { isLocalFilesystemWorkspace } from "./workspaceRuntimeService";
import { connectLocalEnvToProcess } from "./localEnvFileService";
import { scanArtifactsForApps } from "./projectRegistryService";

export type TerminalRunResult = {
  command: string;
  cwd: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  ok: boolean;
  truncated?: boolean;
};

const MAX_OUTPUT = 48_000;
const DEFAULT_TIMEOUT_MS = 120_000;

const BLOCKED_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\brm\s+(-[^\s]*\s+)*-rf\s+\/(?:\s|$)/i, reason: "recursive delete of filesystem root" },
  { pattern: /\brm\s+(-[^\s]*\s+)*-rf\s+~(?:\s|$)/i, reason: "recursive delete of home directory" },
  { pattern: /\bmkfs\b/i, reason: "filesystem format" },
  { pattern: /\bdd\s+if=/i, reason: "raw disk write" },
  { pattern: /\bsudo\b/i, reason: "sudo not allowed from agent terminal" },
  { pattern: /\bchmod\s+(-[^\s]*\s+)*777\s+\/(?:\s|$)/i, reason: "chmod 777 on root" },
  { pattern: /:\(\)\s*\{\s*:\|:&\s*\};:/, reason: "fork bomb" },
  { pattern: /\bgit\s+push\b[^;\n]*--force\b[^;\n]*(main|master)\b/i, reason: "force push to main/master blocked" },
  { pattern: /\bgit\s+push\b[^;\n]*(main|master)\b[^;\n]*--force\b/i, reason: "force push to main/master blocked" },
  { pattern: />\s*\/dev\/(?:sd|hd|nvme)/i, reason: "write to block device" },
];

export function detectTerminalIntent(message: string): boolean {
  return parseTerminalCommands(message).length > 0;
}

export function parseTerminalCommands(message: string): string[] {
  const trimmed = message.trim();
  if (!trimmed) return [];

  const codeBlock = trimmed.match(/```(?:bash|sh|shell|zsh|terminal)?\s*\n([\s\S]+?)```/i);
  const body = codeBlock ? codeBlock[1] : trimmed;

  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .map((line) => line.replace(/^\$\s*/, ""))
    .filter((line) => line && !line.startsWith("#"));

  if (lines.length > 1) {
    return lines.filter((line) => looksLikeShellLine(line));
  }

  const single = lines[0] || body.replace(/^\$\s*/, "").trim();
  if (!single) return [];

  const backtickOnly = single.match(/^`([^`]+)`$/);
  if (backtickOnly) return [backtickOnly[1].trim()];

  const runQuoted = single.match(/\b(?:run|execute|exec|terminal(?:\s+command)?|shell)\s*[:.]?\s*[`'"]([^`'"]+)[`'"]/i);
  if (runQuoted) return [runQuoted[1].trim()];

  const runRest = single.match(/\b(?:run|execute|exec|terminal(?:\s+command)?|shell)\s*[:.]?\s*(.+)$/i);
  if (runRest) {
    const cmd = runRest[1].trim();
    if (cmd && !/^(the|this|my|a)\s/i.test(cmd)) return [cmd];
  }

  if (looksLikeShellLine(single)) return [single];

  return [];
}

function looksLikeShellLine(line: string): boolean {
  return /^(git|pnpm|npm|npx|node|bash|sh|ls|cd|cat|grep|find|curl|wget|flutter|docker|gh|make|cargo|go|python3?|yarn|turbo|vite|export|env|pnpm run|npm run)\b/i.test(
    line,
  );
}

export function parseTerminalCommand(message: string): { command: string; cwd?: string } | null {
  const commands = parseTerminalCommands(message);
  if (!commands.length) return null;
  return { command: commands.join(" && ") };
}

export function validateTerminalCommand(command: string): { ok: true } | { ok: false; reason: string } {
  const normalized = command.trim();
  if (!normalized) return { ok: false, reason: "empty command" };
  if (normalized.length > 4000) return { ok: false, reason: "command too long" };
  for (const rule of BLOCKED_PATTERNS) {
    if (rule.pattern.test(normalized)) return { ok: false, reason: rule.reason };
  }
  return { ok: true };
}

function resolveCwd(cwd?: string, projectId?: string): string {
  const root = path.resolve(repoPath());
  const app = projectId ? scanArtifactsForApps().find((a) => a.id === projectId) : null;
  const base = app ? path.resolve(root, app.path) : root;
  const target = cwd ? path.resolve(base, cwd) : base;
  if (!target.startsWith(root)) {
    throw Object.assign(new Error("cwd outside repo"), { status: 403, code: "terminal.forbidden" });
  }
  return target;
}

export function executeTerminalCommand(input: {
  command: string;
  cwd?: string;
  projectId?: string;
  timeoutMs?: number;
}): Promise<TerminalRunResult> {
  if (isLocalFilesystemWorkspace()) connectLocalEnvToProcess();
  const cwd = resolveCwd(input.cwd, input.projectId);
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise((resolve) => {
    const started = Date.now();
    let stdout = "";
    let stderr = "";
    let truncated = false;

    const append = (buf: string, stream: "out" | "err") => {
      const chunk = buf.toString();
      if (stream === "out") stdout += chunk;
      else stderr += chunk;
      if (stdout.length + stderr.length > MAX_OUTPUT) {
        truncated = true;
        stdout = stdout.slice(0, MAX_OUTPUT);
        stderr = stderr.slice(0, Math.max(0, MAX_OUTPUT - stdout.length));
      }
    };

    const child = spawn(input.command, {
      cwd,
      shell: true,
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1", CI: "1" },
    });

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 2000);
    }, timeoutMs);

    child.stdout?.on("data", (d) => append(d, "out"));
    child.stderr?.on("data", (d) => append(d, "err"));

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        command: input.command,
        cwd,
        exitCode: 1,
        stdout: stdout.trim(),
        stderr: `${stderr}\n${err.message}`.trim(),
        durationMs: Date.now() - started,
        ok: false,
        truncated,
      });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        command: input.command,
        cwd,
        exitCode: code ?? 1,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        durationMs: Date.now() - started,
        ok: code === 0,
        truncated,
      });
    });
  });
}

export type TerminalAgentResult = {
  reply: string;
  executed: string[];
  suggestions: string[];
  terminal: TerminalRunResult;
};

export async function runTerminalAgent(input: { message: string }): Promise<TerminalAgentResult | null> {
  if (!detectTerminalIntent(input.message)) return null;

  if (!isLocalFilesystemWorkspace()) {
    return {
      reply: "**Terminal** runs only in local dev workspace (monorepo on disk). Cloud studio cannot execute shell commands.",
      executed: [],
      suggestions: ["Use local dev: pnpm run dev:admin-local", "Say: run `git status` locally"],
      terminal: {
        command: "(blocked)",
        cwd: repoPath(),
        exitCode: 1,
        stdout: "",
        stderr: "Cloud runtime — no local shell",
        durationMs: 0,
        ok: false,
      },
    };
  }

  const parsed = parseTerminalCommand(input.message);
  if (!parsed) {
    return {
      reply: "Could not parse a shell command. Try:\n- `git status`\n- Paste: `pnpm typecheck`\n- Multi-line paste in Config → Terminal",
      executed: [],
      suggestions: ["run `git status`", "run `pnpm --filter @workspace/api-server typecheck`"],
      terminal: {
        command: "(parse failed)",
        cwd: repoPath(),
        exitCode: 1,
        stdout: "",
        stderr: "No command parsed",
        durationMs: 0,
        ok: false,
      },
    };
  }

  const commands = parseTerminalCommands(input.message);
  let combinedStdout = "";
  let combinedStderr = "";
  let lastResult: TerminalRunResult | null = null;
  const started = Date.now();

  for (const command of commands.length ? commands : [parsed.command]) {
    const validation = validateTerminalCommand(command);
    if (!validation.ok) {
      return {
        reply: `Command blocked: **${validation.reason}**\n\n\`${command}\``,
        executed: [],
        suggestions: ["Use a safer alternative", "run `git status`"],
        terminal: {
          command,
          cwd: repoPath(),
          exitCode: 1,
          stdout: combinedStdout.trim(),
          stderr: `Blocked: ${validation.reason}`,
          durationMs: Date.now() - started,
          ok: false,
        },
      };
    }
    const result = await executeTerminalCommand({ command, cwd: parsed.cwd });
    lastResult = result;
    if (result.stdout) combinedStdout += (combinedStdout ? "\n" : "") + result.stdout;
    if (result.stderr) combinedStderr += (combinedStderr ? "\n" : "") + result.stderr;
    if (!result.ok) break;
  }

  const result = lastResult!;
  result.stdout = combinedStdout.trim();
  result.stderr = combinedStderr.trim();
  result.command = commands.length > 1 ? commands.join(" && ") : result.command;
  result.durationMs = Date.now() - started;

  const outBlock = result.stdout ? `\`\`\`\n${result.stdout}\n\`\`\`` : "";
  const errBlock = result.stderr ? `\n**stderr**\n\`\`\`\n${result.stderr}\n\`\`\`` : "";
  const status = result.ok ? "✓ exit 0" : `✗ exit ${result.exitCode}`;

  return {
    reply:
      `**Terminal** ${status} · ${result.durationMs}ms\n\n` +
      `\`${result.command}\`\n` +
      (result.cwd !== repoPath() ? `cwd: \`${path.relative(repoPath(), result.cwd) || "."}\`\n` : "") +
      outBlock +
      errBlock +
      (result.truncated ? "\n\n_Output truncated._" : ""),
    executed: [`Terminal: ${result.command.slice(0, 80)}${result.command.length > 80 ? "…" : ""} (${status})`],
    suggestions: result.ok
      ? ["run `git status`", "run `pnpm typecheck`"]
      : ["Fix errors and retry", "run `git status`"],
    terminal: result,
  };
}
