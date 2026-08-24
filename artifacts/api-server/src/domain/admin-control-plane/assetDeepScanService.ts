import { createHash } from "node:crypto";
import type { UniversalAssetKind } from "./universalImplementService";

export type DeepScanFinding = {
  category: string;
  detail: string;
  severity: "info" | "warn" | "error";
  line?: number;
};

export type DeepScanReport = {
  fileName: string;
  byteSize: number;
  sha256: string;
  mimeType: string;
  kind: UniversalAssetKind;
  findings: DeepScanFinding[];
  microDetails: Record<string, unknown>;
  summary: string;
  passed: boolean;
};

const MAX_TEXT_BYTES = 8_000_000;

function push(findings: DeepScanFinding[], category: string, detail: string, severity: DeepScanFinding["severity"] = "info", line?: number) {
  findings.push({ category, detail, severity, line });
}

function imageDimensions(buf: Buffer, mimeType: string, fileName: string): { width?: number; height?: number } {
  if (buf.length >= 24 && (mimeType === "image/png" || fileName.endsWith(".png"))) {
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    if (width > 0 && height > 0 && width < 20000 && height < 20000) return { width, height };
  }
  if (buf.length >= 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 8) {
      if (buf[i] !== 0xff) break;
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8) {
        const height = buf.readUInt16BE(i + 5);
        const width = buf.readUInt16BE(i + 7);
        if (width > 0 && height > 0) return { width, height };
      }
      i += 2 + len;
    }
  }
  return {};
}

function walkJson(value: unknown, path: string, depth: number, findings: DeepScanFinding[], stats: { keys: number; arrays: number; maxDepth: number }) {
  if (depth > stats.maxDepth) stats.maxDepth = depth;
  if (depth > 12) return;
  if (Array.isArray(value)) {
    stats.arrays += 1;
    push(findings, "json", `${path}[] — ${value.length} items`, "info");
    value.slice(0, 20).forEach((v, idx) => walkJson(v, `${path}[${idx}]`, depth + 1, findings, stats));
    return;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    stats.keys += entries.length;
    for (const [k, v] of entries.slice(0, 40)) {
      walkJson(v, path ? `${path}.${k}` : k, depth + 1, findings, stats);
    }
    return;
  }
  if (typeof value === "string" && value.length > 120) {
    push(findings, "json", `${path} — string(${value.length})`, "info");
  }
}

function scanTextContent(text: string, fileName: string, findings: DeepScanFinding[], micro: Record<string, unknown>) {
  const lines = text.split("\n");
  micro.lineCount = lines.length;
  micro.charCount = text.length;

  const imports = text.match(/^\s*import\s+.+/gm) || [];
  const exports = text.match(/^\s*export\s+.+/gm) || [];
  micro.importCount = imports.length;
  micro.exportCount = exports.length;
  push(findings, "structure", `${lines.length} lines · ${imports.length} imports · ${exports.length} exports`);

  const components = [...text.matchAll(/(?:export\s+)?(?:function|const)\s+([A-Z][A-Za-z0-9_]*)/g)].map((m) => m[1]);
  if (components.length) {
    micro.components = [...new Set(components)].slice(0, 40);
    push(findings, "react", `Components: ${(micro.components as string[]).slice(0, 8).join(", ")}${components.length > 8 ? "…" : ""}`);
  }

  const hooks = [...text.matchAll(/\b(use[A-Z][A-Za-z0-9_]*)\s*\(/g)].map((m) => m[1]);
  if (hooks.length) {
    micro.hooks = [...new Set(hooks)];
    push(findings, "react", `Hooks: ${(micro.hooks as string[]).join(", ")}`);
  }

  const aria = [...text.matchAll(/\b(aria-[a-z-]+)=/gi)].map((m) => m[1].toLowerCase());
  if (aria.length) {
    micro.aria = [...new Set(aria)];
    push(findings, "a11y", `ARIA: ${(micro.aria as string[]).join(", ")}`);
  }

  const handlers = [...text.matchAll(/\bon[A-Z][A-Za-z]+\s*=/g)].map((m) => m[0].replace(/\s*=$/, ""));
  if (handlers.length) {
    micro.eventHandlers = [...new Set(handlers)].slice(0, 20);
    push(findings, "react", `${handlers.length} event handler(s)`);
  }

  const apiCalls = [...text.matchAll(/\b(fetch|axios\.(?:get|post|put|delete)|useSWR|useQuery)\s*\(/g)].map((m) => m[1]);
  if (apiCalls.length) {
    micro.apiCalls = [...new Set(apiCalls)];
    push(findings, "network", `API calls: ${(micro.apiCalls as string[]).join(", ")}`);
  }

  const relImports = imports.filter((l) => /from\s+["']\./.test(l)).length;
  const absImports = imports.length - relImports;
  if (imports.length) {
    micro.importStyle = { relative: relImports, absolute: absImports };
    push(findings, "structure", `Imports — relative:${relImports} absolute:${absImports}`);
  }

  if (/export\s+default\b/.test(text)) micro.hasDefaultExport = true;
  if (/export\s+\{/.test(text) || /export\s+(const|function|class)\s+/.test(text)) micro.hasNamedExports = true;

  const inlineStyles = (text.match(/style=\{\{/g) || []).length;
  if (inlineStyles) {
    micro.inlineStyles = inlineStyles;
    push(findings, "style", `${inlineStyles} inline style object(s)`);
  }

  const envRefs = [...text.matchAll(/\bprocess\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]);
  if (envRefs.length) {
    micro.envVars = [...new Set(envRefs)];
    push(findings, "config", `Env refs: ${(micro.envVars as string[]).join(", ")}`, "warn");
  }

  const nodeIds = [...text.matchAll(/data-node-id=["']([^"']+)["']/g)].map((m) => m[1]);
  if (nodeIds.length) {
    micro.dataNodeIds = [...new Set(nodeIds)].slice(0, 50);
    push(findings, "pick", `${nodeIds.length} data-node-id marker(s) — pick-ready`);
  } else if (/\.tsx$|\.jsx$/i.test(fileName)) {
    push(findings, "pick", "No data-node-id — add for live pick binding", "warn");
  }

  const classNames = [...text.matchAll(/className=["'{`]([^"'`]+)["'`}]/g)].map((m) => m[1]).slice(0, 30);
  if (classNames.length) micro.classNames = classNames;

  const colors = [...text.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase());
  if (colors.length) {
    micro.colors = [...new Set(colors)].slice(0, 24);
    push(findings, "style", `${colors.length} color token(s): ${(micro.colors as string[]).slice(0, 6).join(", ")}`);
  }

  const spacing = [...text.matchAll(/(?:padding|margin|gap|font-size)\s*[:=]\s*([^;\s"']+)/gi)].map((m) => m[0]);
  if (spacing.length) {
    micro.spacing = [...new Set(spacing)].slice(0, 20);
    push(findings, "style", `Spacing/font signals: ${(micro.spacing as string[]).slice(0, 4).join(" · ")}`);
  }

  lines.forEach((line, idx) => {
    const n = idx + 1;
    if (/TODO|FIXME|HACK|XXX/i.test(line)) push(findings, "quality", line.trim().slice(0, 100), "warn", n);
    if (/dangerouslySetInnerHTML|eval\s*\(|innerHTML\s*=/.test(line)) push(findings, "security", line.trim().slice(0, 100), "error", n);
    if (/<img\b(?![^>]*\balt=)/i.test(line)) push(findings, "a11y", "img without alt", "warn", n);
    if (/<button\b(?![^>]*\btype=)/i.test(line)) push(findings, "a11y", "button without type", "warn", n);
  });

  const todos = findings.filter((f) => f.category === "quality").length;
  if (todos) micro.openTodos = todos;
}

function scanSvg(text: string, findings: DeepScanFinding[], micro: Record<string, unknown>) {
  const viewBox = text.match(/viewBox=["']([^"']+)["']/i)?.[1];
  if (viewBox) {
    micro.viewBox = viewBox;
    push(findings, "svg", `viewBox=${viewBox}`);
  }
  const ids = [...text.matchAll(/\bid=["']([^"']+)["']/g)].map((m) => m[1]);
  if (ids.length) {
    micro.svgIds = [...new Set(ids)].slice(0, 40);
    push(findings, "svg", `${ids.length} id(s) — ${ids.slice(0, 5).join(", ")}${ids.length > 5 ? "…" : ""}`);
  }
  const paths = (text.match(/<path\b/gi) || []).length;
  const rects = (text.match(/<rect\b/gi) || []).length;
  const circles = (text.match(/<circle\b/gi) || []).length;
  micro.svgElements = { paths, rects, circles };
  push(findings, "svg", `Elements — path:${paths} rect:${rects} circle:${circles}`);
}

export function deepScanAsset(input: {
  fileName: string;
  mimeType: string;
  dataBase64: string;
  kind: UniversalAssetKind;
}): DeepScanReport {
  const buf = Buffer.from(input.dataBase64, "base64");
  const byteSize = buf.length;
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const kind = input.kind;
  const findings: DeepScanFinding[] = [];
  const microDetails: Record<string, unknown> = {
    fileName: input.fileName,
    mimeType: input.mimeType,
    byteSize,
    sha256,
    kind,
    scannedAt: new Date().toISOString(),
  };

  push(findings, "file", `${input.fileName} — ${(byteSize / 1024).toFixed(1)} KB · ${kind}`, "info");

  const dims = imageDimensions(buf, input.mimeType, input.fileName.toLowerCase());
  if (dims.width && dims.height) {
    microDetails.width = dims.width;
    microDetails.height = dims.height;
    microDetails.aspectRatio = Number((dims.width / dims.height).toFixed(3));
    push(findings, "media", `${dims.width}×${dims.height}px`);
  }

  const isTextLike =
    kind === "code" ||
    kind === "config-schema" ||
    kind === "shader" ||
    kind === "native" ||
    input.mimeType.startsWith("text/") ||
    /\.(tsx?|jsx?|css|json|yaml|yml|md|svg|html|sql|glsl|wgsl)$/i.test(input.fileName);

  if (isTextLike && byteSize <= MAX_TEXT_BYTES) {
    const text = buf.toString("utf8");
    if (input.fileName.endsWith(".svg") || kind === "svg-icon") scanSvg(text, findings, microDetails);
    else if (input.fileName.endsWith(".json") || input.mimeType.includes("json")) {
      try {
        const parsed = JSON.parse(text);
        const stats = { keys: 0, arrays: 0, maxDepth: 0 };
        walkJson(parsed, "", 0, findings, stats);
        microDetails.jsonStats = stats;
        push(findings, "json", `${stats.keys} keys · depth ${stats.maxDepth}`);
      } catch (e) {
        push(findings, "json", `Parse error: ${e instanceof Error ? e.message : String(e)}`, "error");
      }
    } else {
      scanTextContent(text, input.fileName, findings, microDetails);
    }
  } else if (byteSize > MAX_TEXT_BYTES) {
    push(findings, "file", `Large binary (${(byteSize / 1024 / 1024).toFixed(1)} MB) — metadata scan only`, "info");
  }

  const errors = findings.filter((f) => f.severity === "error").length;
  const warns = findings.filter((f) => f.severity === "warn").length;
  const summary = `Deep scan · ${findings.length} signals${errors ? ` · ${errors} error(s)` : ""}${warns ? ` · ${warns} warn(s)` : ""}`;

  return {
    fileName: input.fileName,
    byteSize,
    sha256,
    mimeType: input.mimeType,
    kind,
    findings,
    microDetails,
    summary,
    passed: errors === 0,
  };
}

export function summarizeDeepScans(reports: DeepScanReport[]): string {
  if (!reports.length) return "";
  return reports
    .map((r) => {
      const top = r.findings
        .filter((f) => f.severity !== "info")
        .slice(0, 3)
        .map((f) => f.detail)
        .join("; ");
      return `**${r.fileName}** (${(r.byteSize / 1024).toFixed(1)} KB, ${r.kind}) — ${r.summary}${top ? `\n  ↳ ${top}` : ""}`;
    })
    .join("\n");
}
