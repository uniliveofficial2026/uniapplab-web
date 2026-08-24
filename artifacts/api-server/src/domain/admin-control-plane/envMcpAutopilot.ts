import { MCP_PRESETS, readMcpConfig, upsertMcpServer } from "./mcpConfigService";
import { isEnvProviderConfigured } from "./envProviderCatalog";
import { isDevWorkspaceEnabled } from "./workspaceConfigService";

/** Wire MCP presets from .env — no Integrations UI required. */
export function autopilotMcpFromEnv(): void {
  if (!isDevWorkspaceEnabled()) return;

  const links: Array<{ id: keyof typeof MCP_PRESETS; when: boolean }> = [
    { id: "supabase", when: isEnvProviderConfigured("supabase") },
    { id: "firebase", when: isEnvProviderConfigured("firebase") },
    { id: "figma", when: isEnvProviderConfigured("figma") },
    { id: "tencent-rtc", when: isEnvProviderConfigured("tencent") },
    { id: "vercel", when: isEnvProviderConfigured("vercel") },
    { id: "chrome-devtools", when: true },
  ];

  const current = readMcpConfig();
  for (const { id, when } of links) {
    if (!when || current.mcpServers[id]) continue;
    const preset = MCP_PRESETS[id];
    if (!preset) continue;
    const { description: _d, ...config } = preset;
    try {
      upsertMcpServer(id, config, false);
    } catch {
      /* local-only guard */
    }
  }
}
