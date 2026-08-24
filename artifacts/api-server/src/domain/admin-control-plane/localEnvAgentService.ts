import { connectLocalEnvToProcess, upsertLocalEnvEntries } from "./localEnvFileService";
import { isLocalFilesystemWorkspace } from "./workspaceRuntimeService";
import { detectTerminalIntent, parseTerminalCommands, runTerminalAgent, type TerminalRunResult } from "./localTerminalService";

export type EnvAgentResult = {
  reply: string;
  executed: string[];
  suggestions: string[];
  keys: string[];
  silent: boolean;
  terminal?: TerminalRunResult;
};

function parseEnvLine(line: string): { key: string; value: string } | null {
  const t = line.trim();
  if (!t || t.startsWith("#")) return null;
  const m = t.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!m) return null;
  let value = m[2].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return { key: m[1].toUpperCase(), value };
}

export function parseEnvFromMessage(message: string): Record<string, string> {
  const trimmed = message.trim();
  if (!trimmed) return {};

  const codeBlock = trimmed.match(/```(?:env|dotenv|\.env)?\s*\n([\s\S]+?)```/i);
  const body = codeBlock ? codeBlock[1] : trimmed;

  const entries: Record<string, string> = {};
  for (const line of body.split("\n")) {
    const parsed = parseEnvLine(line);
    if (parsed) entries[parsed.key] = parsed.value;
  }
  return entries;
}

/** Split env lines from the rest of the message (e.g. env paste + shell command). */
export function splitEnvAndRemainder(message: string): { entries: Record<string, string>; remainder: string } {
  const trimmed = message.trim();
  if (!trimmed) return { entries: {}, remainder: "" };

  const codeBlock = trimmed.match(/```(?:env|dotenv|\.env)?\s*\n([\s\S]+?)```/i);
  if (codeBlock) {
    const entries = parseEnvFromMessage(codeBlock[0]);
    const remainder = trimmed.replace(codeBlock[0], "").trim();
    return { entries, remainder };
  }

  const envLines: string[] = [];
  const otherLines: string[] = [];

  for (const line of trimmed.split("\n")) {
    const parsed = parseEnvLine(line);
    if (parsed && !/^(git|pnpm|npm|npx|bash|sh|curl|wget|docker|gh|make|yarn|turbo|vite)\b/i.test(line.trim())) {
      envLines.push(line);
    } else {
      otherLines.push(line);
    }
  }

  const entries = parseEnvFromMessage(envLines.join("\n"));
  const envOnly = envLines.length > 0 && Object.keys(entries).length === envLines.filter((l) => l.trim() && !l.trim().startsWith("#")).length;
  const multiEnv = Object.keys(entries).length > 1;
  const singleEnvLine = Object.keys(entries).length === 1 && envLines.length === 1 && otherLines.length === 0;

  if (!Object.keys(entries).length) {
    return { entries: {}, remainder: trimmed };
  }

  if (envOnly || multiEnv || singleEnvLine) {
    return { entries, remainder: otherLines.join("\n").trim() };
  }

  return { entries: {}, remainder: trimmed };
}

export function detectEnvIntent(message: string): boolean {
  const { entries, remainder } = splitEnvAndRemainder(message);
  if (Object.keys(entries).length > 0) return true;

  const lower = message.toLowerCase();
  if (/\b(set|add|update|configure|connect|save)\b.*\b(env|\.env|environment|secret|api key|token)\b/i.test(lower)) {
    return true;
  }
  if (/\b(env|\.env)\b.*\b(set|add|update|configure|connect)\b/i.test(lower)) {
    return true;
  }

  const kvInline = message.match(/\b([A-Z][A-Z0-9_]{2,})\s*=\s*[^\s]+/g);
  if (kvInline && kvInline.length >= 1 && !remainder && !detectTerminalIntent(message)) {
    return kvInline.some((part) => parseEnvLine(part));
  }

  return false;
}

function parseNaturalLanguageEnv(message: string): Record<string, string> {
  const entries: Record<string, string> = {};
  const patterns = [
    /\b(?:set|add|configure|connect)\s+([A-Z][A-Z0-9_]{2,})\s*(?:to|=|:)\s*[`'"]([^`'"]+)[`'"]/gi,
    /\b(?:set|add|configure|connect)\s+([A-Z][A-Z0-9_]{2,})\s*(?:to|=|:)\s*(\S+)/gi,
    /\b([A-Z][A-Z0-9_]{2,})\s*=\s*[`'"]([^`'"]+)[`'"]/g,
  ];
  for (const pattern of patterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(message)) !== null) {
      entries[m[1].toUpperCase()] = m[2].trim();
    }
  }
  return entries;
}

function redactKeys(keys: string[]): string {
  if (!keys.length) return "";
  if (keys.length <= 4) return keys.join(", ");
  return `${keys.slice(0, 4).join(", ")} +${keys.length - 4} more`;
}

export async function runEnvAgent(input: { message: string }): Promise<EnvAgentResult | null> {
  if (!detectEnvIntent(input.message)) return null;

  if (!isLocalFilesystemWorkspace()) {
    return {
      reply: "Env connect runs only in local dev workspace.",
      executed: [],
      suggestions: ["Use pnpm run dev:admin-local"],
      keys: [],
      silent: false,
    };
  }

  connectLocalEnvToProcess();

  let { entries, remainder } = splitEnvAndRemainder(input.message);
  if (!Object.keys(entries).length) {
    entries = parseNaturalLanguageEnv(input.message);
  }

  const keys = Object.keys(entries);
  if (!keys.length) {
    return {
      reply: "Could not parse env keys. Paste `KEY=value` lines or say: set GEMINI_API_KEY to …",
      executed: [],
      suggestions: ["Paste KEY=value lines", "Configure providers in chat"],
      keys: [],
      silent: false,
    };
  }

  const { updated } = upsertLocalEnvEntries(entries);
  connectLocalEnvToProcess();

  const terminalRemainder = remainder.trim();
  if (terminalRemainder && (detectTerminalIntent(terminalRemainder) || parseTerminalCommands(terminalRemainder).length)) {
    const terminalResult = await runTerminalAgent({ message: terminalRemainder });
    if (terminalResult) {
      return {
        reply:
          `✓ Connected **${updated.length}** env key(s): ${redactKeys(updated)} (values hidden)\n\n` +
          terminalResult.reply,
        executed: [`Env: ${updated.length} key(s)`, ...terminalResult.executed],
        suggestions: terminalResult.suggestions,
        keys: updated,
        silent: true,
        terminal: terminalResult.terminal,
      };
    }
  }

  return {
    reply: `✓ Connected **${updated.length}** env key(s) to \`.env.local\`: ${redactKeys(updated)} _(values hidden — ready for terminal & providers)_`,
    executed: updated.map((k) => `Env: ${k}`),
    suggestions: ["run `pnpm typecheck`", "Deploy to Vercel", "Generate with Runway"],
    keys: updated,
    silent: true,
  };
}

export function redactEnvMessageForDisplay(message: string): string {
  const { entries } = splitEnvAndRemainder(message);
  const keys = Object.keys(entries);
  if (!keys.length) return message;
  if (keys.length === Object.keys(parseEnvFromMessage(message)).length && !message.match(/\b(git|pnpm|npm|bash)\b/i)) {
    return `Configured env: ${redactKeys(keys)}`;
  }
  return message.replace(/^[A-Z][A-Z0-9_]*=.*$/gm, (line) => {
    const k = line.match(/^([A-Z][A-Z0-9_]*)=/)?.[1];
    return k ? `${k}=••••` : line;
  });
}
