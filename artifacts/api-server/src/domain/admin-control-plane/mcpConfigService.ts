import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { repoPath } from "../../lib/repoRoot";
import { isStudioEnabled, isLocalFilesystemWorkspace, workspacePersistDir } from "./workspaceRuntimeService";

export type McpServerConfig = {
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  headers?: Record<string, string>;
};

export type McpConfigFile = {
  mcpServers: Record<string, McpServerConfig>;
};

const CURSOR_MCP = () => repoPath(".cursor", "mcp.json");
const LOCAL_MCP = () => path.join(workspacePersistDir("mcp"), "workspace-mcp.json");

export const MCP_PRESETS: Record<string, McpServerConfig & { description: string }> = {
  supabase: {
    description: "Supabase docs, database, storage, edge functions",
    url: "https://mcp.supabase.com/mcp",
  },
  "chrome-devtools": {
    description: "Browser automation and page inspection",
    command: "/opt/homebrew/bin/npx",
    args: ["-y", "chrome-devtools-mcp@latest", "--autoConnect", "--no-usage-statistics"],
    env: {
      PATH: "/opt/homebrew/bin:/usr/bin:/bin",
      CHROME_DEVTOOLS_MCP_NO_USAGE_STATISTICS: "1",
    },
  },
  firebase: {
    description: "Firebase projects, Firestore, Auth, deploy",
    command: "npx",
    args: ["-y", "firebase-tools@latest", "mcp"],
  },
  vercel: {
    description: "Vercel deployments, logs, projects",
    url: "https://mcp.vercel.com",
  },
  figma: {
    description: "Figma design context, Code Connect, screenshots",
    url: "https://mcp.figma.com/mcp",
  },
  "tencent-rtc": {
    description: "Tencent TRTC / Chat / Live documentation and integration",
    command: "npx",
    args: ["-y", "@tencentcloud/trtc-mcp-server@latest"],
  },
  runway: {
    description: "Runway video/image generation (OAuth MCP — use native API in Omni for RUNWAY_API_KEY)",
    url: "https://mcp.runwayml.com/mcp",
  },
};

function studioEnabled(): boolean {
  return isStudioEnabled();
}

function readJsonFile(filePath: string): McpConfigFile | null {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as McpConfigFile;
  } catch {
    return null;
  }
}

function mergeMcpConfigs(...configs: Array<McpConfigFile | null>): McpConfigFile {
  const merged: McpConfigFile = { mcpServers: {} };
  for (const cfg of configs) {
    if (!cfg?.mcpServers) continue;
    Object.assign(merged.mcpServers, cfg.mcpServers);
  }
  return merged;
}

export function readMcpConfig(): McpConfigFile {
  if (!studioEnabled()) return { mcpServers: {} };
  const cursor = isLocalFilesystemWorkspace() ? readJsonFile(CURSOR_MCP()) : null;
  return mergeMcpConfigs(cursor, readJsonFile(LOCAL_MCP()));
}

export function readMcpConfigSources(): { cursor: McpConfigFile | null; local: McpConfigFile | null; merged: McpConfigFile } {
  const cursor = isLocalFilesystemWorkspace() ? readJsonFile(CURSOR_MCP()) : null;
  const local = studioEnabled() ? readJsonFile(LOCAL_MCP()) : null;
  return { cursor, local, merged: mergeMcpConfigs(cursor, local) };
}

export function writeLocalMcpConfig(config: McpConfigFile): McpConfigFile {
  if (!studioEnabled()) {
    throw Object.assign(new Error("mcp disabled"), { status: 404, code: "error.notFound" });
  }
  mkdirSync(workspacePersistDir("mcp"), { recursive: true });
  writeFileSync(LOCAL_MCP(), `${JSON.stringify(config, null, 2)}\n`);
  return config;
}

export function upsertMcpServer(serverId: string, config: McpServerConfig, applyToCursor = false): McpConfigFile {
  if (!studioEnabled()) {
    throw Object.assign(new Error("mcp disabled"), { status: 404, code: "error.notFound" });
  }
  const local = readJsonFile(LOCAL_MCP()) || { mcpServers: {} };
  local.mcpServers[serverId] = config;
  writeLocalMcpConfig(local);

  if (applyToCursor && isLocalFilesystemWorkspace()) {
    const cursor = readJsonFile(CURSOR_MCP()) || { mcpServers: {} };
    cursor.mcpServers[serverId] = config;
    mkdirSync(repoPath(".cursor"), { recursive: true });
    writeFileSync(CURSOR_MCP(), `${JSON.stringify(cursor, null, 2)}\n`);
  }

  return readMcpConfig();
}

export function removeMcpServer(serverId: string, applyToCursor = false): McpConfigFile {
  if (!studioEnabled()) {
    throw Object.assign(new Error("mcp disabled"), { status: 404, code: "error.notFound" });
  }
  const local = readJsonFile(LOCAL_MCP()) || { mcpServers: {} };
  delete local.mcpServers[serverId];
  writeLocalMcpConfig(local);

  if (applyToCursor && isLocalFilesystemWorkspace()) {
    const cursor = readJsonFile(CURSOR_MCP());
    if (cursor?.mcpServers) {
      delete cursor.mcpServers[serverId];
      writeFileSync(CURSOR_MCP(), `${JSON.stringify(cursor, null, 2)}\n`);
    }
  }

  return readMcpConfig();
}

export function applyLocalMcpToCursor(): McpConfigFile {
  if (!studioEnabled()) {
    throw Object.assign(new Error("mcp disabled"), { status: 404, code: "error.notFound" });
  }
  if (!isLocalFilesystemWorkspace()) {
    throw Object.assign(new Error("cursor sync local only"), { status: 400, code: "error.invalid" });
  }
  const merged = readMcpConfig();
  mkdirSync(repoPath(".cursor"), { recursive: true });
  writeFileSync(CURSOR_MCP(), `${JSON.stringify(merged, null, 2)}\n`);
  return merged;
}
