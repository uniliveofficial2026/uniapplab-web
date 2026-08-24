import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

/** Formats far beyond JS/TS — configs, shaders, native, schemas, infra, docs. */
export type ArtifactFormat =
  | "tsx"
  | "ts"
  | "jsx"
  | "js"
  | "css"
  | "scss"
  | "html"
  | "vue"
  | "svelte"
  | "json"
  | "yaml"
  | "toml"
  | "xml"
  | "graphql"
  | "sql"
  | "prisma"
  | "glsl"
  | "wgsl"
  | "swift"
  | "kotlin"
  | "dart"
  | "python"
  | "go"
  | "rust"
  | "java"
  | "csharp"
  | "md"
  | "mdx"
  | "proto"
  | "wasm"
  | "i18n"
  | "csv"
  | "env"
  | "docker"
  | "k8s"
  | "firebase-rules"
  | "supabase-policy"
  | "tailwind-config"
  | "design-tokens"
  | "motion-spec"
  | "shader"
  | "native-bridge"
  | "binary"
  | "unknown";

export type ConvertedArtifact = {
  fileName: string;
  format: ArtifactFormat;
  resourceType: string;
  resourceId: string;
  content: string;
  role: "primary" | "integration" | "tokens" | "theme" | "motion" | "docs" | "config" | "schema";
  language: string;
};

export type ConversionSummary = {
  fileName: string;
  format: ArtifactFormat;
  resourceId: string;
  role: string;
  language: string;
};

const EXT_MAP: Record<string, ArtifactFormat> = {
  tsx: "tsx",
  ts: "ts",
  jsx: "jsx",
  js: "js",
  mjs: "js",
  cjs: "js",
  css: "css",
  scss: "scss",
  sass: "scss",
  less: "css",
  html: "html",
  htm: "html",
  vue: "vue",
  svelte: "svelte",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  xml: "xml",
  gql: "graphql",
  graphql: "graphql",
  sql: "sql",
  prisma: "prisma",
  glsl: "glsl",
  frag: "glsl",
  vert: "glsl",
  wgsl: "wgsl",
  swift: "swift",
  kt: "kotlin",
  kts: "kotlin",
  dart: "dart",
  py: "python",
  go: "go",
  rs: "rust",
  java: "java",
  cs: "csharp",
  md: "md",
  mdx: "mdx",
  proto: "proto",
  wasm: "wasm",
  csv: "csv",
  env: "env",
  dockerfile: "docker",
};

function geminiModel() {
  const apiKey = String(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "").trim();
  if (!apiKey) return null;
  return createGoogleGenerativeAI({ apiKey })("gemini-2.5-flash");
}

function extractJson(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced?.[1] || text).trim();
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
}

function slug(name: string): string {
  return name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "artifact";
}

export function detectArtifactFormat(fileName: string, content?: string): ArtifactFormat {
  const lower = fileName.toLowerCase();
  const base = lower.split("/").pop() || lower;
  if (base === "dockerfile") return "docker";
  if (base.startsWith(".env")) return "env";
  if (/firebase.*rules|firestore\.rules/.test(base)) return "firebase-rules";
  if (/supabase|rls|policy/.test(base) && base.endsWith(".sql")) return "supabase-policy";
  if (/tailwind\.config/.test(base)) return "tailwind-config";
  if (/tokens?\.(json|yaml|yml)/.test(base)) return "design-tokens";
  if (/\.(strings|arb)$/.test(base) || /i18n|locale|translation/.test(base)) return "i18n";
  if (/\.(glsl|frag|vert)$/i.test(base)) return "glsl";
  const ext = base.split(".").pop() || "";
  if (EXT_MAP[ext]) return EXT_MAP[ext];
  if (content) {
    const head = content.slice(0, 800).trim();
    if (head.startsWith("{") && /"(v|fr|layers)"\s*:/.test(head)) return "json";
    if (head.startsWith("type ") || head.includes("interface ") || head.includes("query ") || head.includes("mutation "))
      return "graphql";
    if (/^---\s/m.test(head) || /^[\w-]+:\s/m.test(head)) return "yaml";
    if (/^#include\s|<!DOCTYPE/i.test(head)) return head.includes("glsl") ? "glsl" : "html";
    if (/^(package|import)\s/.test(head)) return "go";
    if (/^(fn |use |pub )/.test(head)) return "rust";
    if (/^(def |class )/.test(head)) return "python";
    if (/^(func |package )/.test(head)) return "go";
  }
  return "unknown";
}

export function resourceTypeForFormat(format: ArtifactFormat): string {
  const map: Record<ArtifactFormat, string> = {
    tsx: "ui.node",
    ts: "ui.node",
    jsx: "ui.node",
    js: "ui.node",
    css: "ui.layout",
    scss: "ui.layout",
    html: "ui.node",
    vue: "ui.node",
    svelte: "ui.node",
    json: "ui.token-set",
    yaml: "ui.token-set",
    toml: "ui.token-set",
    xml: "ui.node",
    graphql: "ui.node",
    sql: "ui.node",
    prisma: "ui.node",
    glsl: "ui.motion",
    wgsl: "ui.motion",
    swift: "ui.node",
    kotlin: "ui.node",
    dart: "ui.node",
    python: "ui.node",
    go: "ui.node",
    rust: "ui.node",
    java: "ui.node",
    csharp: "ui.node",
    md: "ui.node",
    mdx: "ui.node",
    proto: "ui.node",
    wasm: "ui.asset",
    i18n: "ui.translation",
    csv: "ui.token-set",
    env: "ui.node",
    docker: "ui.node",
    k8s: "ui.node",
    "firebase-rules": "ui.node",
    "supabase-policy": "ui.node",
    "tailwind-config": "ui.theme",
    "design-tokens": "ui.token-set",
    "motion-spec": "ui.motion",
    shader: "ui.motion",
    "native-bridge": "ui.node",
    binary: "ui.asset",
    unknown: "ui.node",
  };
  return map[format] || "ui.node";
}

function languageLabel(format: ArtifactFormat): string {
  return format.replace(/-/g, " ");
}

/** Rule-based companions — no LLM required. */
export function ruleBasedCompanions(input: {
  fileName: string;
  format: ArtifactFormat;
  content: string;
  targetResourceId?: string | null;
  previewUrl?: string;
}): ConvertedArtifact[] {
  const base = slug(input.fileName);
  const target = input.targetResourceId || `node.upload.${base}`;
  const out: ConvertedArtifact[] = [];

  out.push({
    fileName: input.fileName,
    format: input.format,
    resourceType: resourceTypeForFormat(input.format),
    resourceId: target,
    content: input.content,
    role: "primary",
    language: languageLabel(input.format),
  });

  if (input.format === "design-tokens" || (input.format === "json" && /"tokens"|"color"|"spacing"/.test(input.content.slice(0, 500)))) {
    out.push({
      fileName: `${base}.theme.css`,
      format: "css",
      resourceType: "ui.theme",
      resourceId: `theme.generated.${base}`,
      content: tokensJsonToCss(input.content),
      role: "theme",
      language: "css variables",
    });
  }

  if (input.format === "graphql") {
    out.push({
      fileName: `${base}.hooks.ts`,
      format: "ts",
      resourceType: "ui.node",
      resourceId: `node.integration.${base}`,
      content: graphqlToHookStub(input.content, base),
      role: "integration",
      language: "typescript",
    });
  }

  if (input.format === "glsl" || input.format === "wgsl") {
    out.push({
      fileName: `${base}.motion.json`,
      format: "motion-spec",
      resourceType: "ui.motion",
      resourceId: `motion.shader.${base}`,
      content: JSON.stringify({ presetId: `motion.shader.${base}`, shaderLang: input.format, note: "Shader staged for motion pipeline" }, null, 2),
      role: "motion",
      language: "motion spec",
    });
  }

  if (input.format === "i18n" || (input.format === "json" && /"en"|"locale"|"translation"/.test(input.content.slice(0, 300)))) {
    out.push({
      fileName: `${base}.registry.ts`,
      format: "ts",
      resourceType: "ui.translation",
      resourceId: `translation.upload.${base}`,
      content: i18nToRegistry(input.content, base),
      role: "integration",
      language: "typescript",
    });
  }

  if (input.previewUrl && /\.(png|jpe?g|webp|svg)$/i.test(input.fileName)) {
    out.push({
      fileName: `${base}.tsx`,
      format: "tsx",
      resourceType: "ui.node",
      resourceId: `node.asset.${base}`,
      content: imageToComponent(input.fileName, input.previewUrl, base),
      role: "integration",
      language: "react tsx",
    });
  }

  if (input.format === "sql" || input.format === "supabase-policy") {
    out.push({
      fileName: `${base}.schema.md`,
      format: "md",
      resourceType: "ui.node",
      resourceId: `docs.schema.${base}`,
      content: `# Schema reference\n\n\`\`\`sql\n${input.content.slice(0, 12000)}\n\`\`\`\n\n_Staged as documentation — not executed._`,
      role: "docs",
      language: "markdown",
    });
  }

  return out;
}

function tokensJsonToCss(raw: string): string {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const tokens = (data.tokens || data) as Record<string, unknown>;
    const lines = [":root {"];
    for (const [k, v] of Object.entries(tokens)) {
      if (typeof v === "string" || typeof v === "number") lines.push(`  --${k.replace(/\./g, "-")}: ${v};`);
    }
    lines.push("}");
    return lines.join("\n");
  } catch {
    return `/* design tokens */\n:root {}\n`;
  }
}

function graphqlToHookStub(schema: string, base: string): string {
  const name = base.replace(/-/g, "_");
  return `/** Auto-generated GraphQL integration stub — wire to your API client. */
export const ${name}Documents = ${JSON.stringify(schema.slice(0, 4000))};
export function use${base.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join("")}Query() {
  return { loading: false, data: null, error: null };
}
`;
}

function i18nToRegistry(raw: string, base: string): string {
  return `/** i18n registry generated from ${base} */
export const ${base.replace(/-/g, "_")}Catalog = ${raw.slice(0, 8000)} as const;
export type ${base.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join("")}Keys = keyof typeof ${base.replace(/-/g, "_")}Catalog;
`;
}

function imageToComponent(fileName: string, url: string, base: string): string {
  const comp = base.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join("");
  return `import React from 'react';

/** Auto-generated from ${fileName} */
export function ${comp}Asset() {
  return (
    <img
      src=${JSON.stringify(url)}
      alt=${JSON.stringify(fileName)}
      className="max-w-full h-auto"
      data-universal-implement=${JSON.stringify(base)}
    />
  );
}
`;
}

/** LLM cross-format conversion — writes integration + tokens + docs beyond source language. */
export async function aiExpandArtifacts(input: {
  fileName: string;
  format: ArtifactFormat;
  content: string;
  mimeType?: string;
  dataBase64?: string;
  targetResourceId?: string | null;
}): Promise<ConvertedArtifact[]> {
  const model = geminiModel();
  if (!model) return [];

  const isVisual = input.dataBase64 && input.mimeType?.startsWith("image/");
  const prompt = `UniLive's Universal Conversion Agent — output artifacts FAR BEYOND the input language.
Input: ${input.fileName} (${input.format})
Target: ${input.targetResourceId || "auto"}
Rules: preserve exact semantics; no guessing; UniLive's brand; no secrets.
Return ONLY JSON:
{
  "artifacts": [
    { "fileName": "", "format": "tsx|css|json|yaml|graphql|md|glsl|swift|kotlin|...", "resourceType": "ui.node|ui.theme|ui.token-set|ui.motion|ui.translation", "resourceId": "", "content": "", "role": "integration|tokens|theme|motion|docs|config", "language": "" }
  ]
}
Generate 2-5 companion artifacts: React integration, design tokens, theme CSS, motion spec, i18n keys, docs — as appropriate.
${isVisual ? "Visual input attached." : `Content preview:\n${input.content.slice(0, 6000)}`}`;

  const messages = isVisual
    ? [{
        role: "user" as const,
        content: [
          { type: "text" as const, text: prompt },
          { type: "image" as const, image: `data:${input.mimeType};base64,${input.dataBase64}` },
        ],
      }]
    : [{ role: "user" as const, content: prompt }];

  const result = await generateText({ model, maxOutputTokens: 8192, messages }).catch(() => ({ text: "" }));
  const parsed = extractJson(result.text);
  if (!parsed || !Array.isArray(parsed.artifacts)) return [];

  return (parsed.artifacts as Array<Record<string, unknown>>)
    .filter((a) => a.content && a.fileName)
    .slice(0, 6)
    .map((a) => ({
      fileName: String(a.fileName),
      format: (String(a.format || "unknown") as ArtifactFormat) || "unknown",
      resourceType: String(a.resourceType || "ui.node"),
      resourceId: String(a.resourceId || `node.generated.${slug(String(a.fileName))}`),
      content: String(a.content),
      role: (String(a.role || "integration") as ConvertedArtifact["role"]) || "integration",
      language: String(a.language || String(a.format)),
    }));
}

export async function convertInputToArtifacts(input: {
  fileName: string;
  mimeType: string;
  dataBase64: string;
  targetResourceId?: string | null;
  previewUrl?: string;
  textContent?: string;
}): Promise<ConvertedArtifact[]> {
  const isText = /\.(tsx?|jsx?|js|css|scss|html|md|json|yaml|yml|toml|xml|graphql|gql|sql|glsl|wgsl|swift|kt|py|go|rs|java|cs|proto|csv|env|mdx|vue|svelte|prisma)$/i.test(
    input.fileName,
  ) || input.mimeType.startsWith("text/") || input.mimeType.includes("json") || input.mimeType.includes("xml");

  const content =
    input.textContent ??
    (isText ? Buffer.from(input.dataBase64, "base64").toString("utf8") : "");

  const format = detectArtifactFormat(input.fileName, content);
  const rule = ruleBasedCompanions({
    fileName: input.fileName,
    format: format === "unknown" && content ? detectArtifactFormat(input.fileName, content) : format,
    content: content || `[binary:${input.fileName}]`,
    targetResourceId: input.targetResourceId,
    previewUrl: input.previewUrl,
  });

  const ai = await aiExpandArtifacts({
    fileName: input.fileName,
    format,
    content,
    mimeType: input.mimeType,
    dataBase64: input.dataBase64,
    targetResourceId: input.targetResourceId,
  });

  const seen = new Set<string>();
  return [...rule, ...ai].filter((a) => {
    const key = `${a.resourceId}:${a.fileName}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function summarizeArtifacts(artifacts: ConvertedArtifact[]): ConversionSummary[] {
  return artifacts.map((a) => ({
    fileName: a.fileName,
    format: a.format,
    resourceId: a.resourceId,
    role: a.role,
    language: a.language,
  }));
}
