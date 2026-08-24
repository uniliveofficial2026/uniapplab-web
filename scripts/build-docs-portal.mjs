#!/usr/bin/env node
/**
 * Minimal docs portal — static site from docs/stage-c + curated sections.
 */
import { createServer } from 'node:http';
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs-portal', 'dist');
const SRC = join(ROOT, 'docs', 'stage-c');

const SECTIONS = [
  ['Getting Started', '00-STAGE-C-BASELINE.md'],
  ['Installation', '01-PRODUCT-SCOPE.md'],
  ['Architecture', '02-PACKAGE-MAP.md'],
  ['CLI', '06-CLI.md'],
  ['SDK', '04-SDK.md'],
  ['MCP', '05-MCP.md'],
  ['UI Kit', '18-UI-KIT-FOUNDATION.md'],
  ['Security', '10-SECURITY-MODEL.md'],
  ['Self Host', '20-SELF-HOST-READINESS.md'],
  ['API', '03-PUBLIC-API.md'],
  ['Test Matrix', '22-TEST-MATRIX.md'],
  ['License Decision', 'LICENSE-DECISION.md'],
];

function mdToHtml(md, title) {
  const body = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n\n/g, '</p><p>');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><title>${title} · UniLive Docs</title>
<style>
body{font-family:ui-sans-serif,system-ui;margin:0;display:grid;grid-template-columns:240px 1fr;min-height:100vh;background:#0b0b0f;color:#f5f5f7}
nav{padding:1rem;border-right:1px solid #2a2a36;background:#14141a}
nav a{display:block;color:#a1a1aa;text-decoration:none;padding:.35rem 0}
nav a:hover{color:#fff}
main{padding:2rem;max-width:880px}
code{background:#1c1c24;padding:0 .25rem;border-radius:4px}
</style></head><body>
<nav><strong>UniLive Docs</strong>${SECTIONS.map(([label, file]) => `<a href="./${file.replace(/\.md$/, '.html')}">${label}</a>`).join('')}</nav>
<main><p>${body}</p></main></body></html>`;
}

export async function buildDocsPortal() {
  await mkdir(OUT, { recursive: true });
  const files = await readdir(SRC);
  let built = 0;
  for (const file of files) {
    if (!file.endsWith('.md') && file !== 'LICENSE-DECISION.md') continue;
    if (!file.endsWith('.md')) continue;
    const md = await readFile(join(SRC, file), 'utf8');
    const html = mdToHtml(md, file);
    await writeFile(join(OUT, file.replace(/\.md$/, '.html')), html);
    built += 1;
  }
  // index
  const indexLinks = SECTIONS.map(
    ([label, file]) => `<li><a href="./${file.replace(/\.md$/, '.html')}">${label}</a></li>`,
  ).join('');
  await writeFile(
    join(OUT, 'index.html'),
    `<!doctype html><html><head><meta charset="utf-8"/><title>UniLive Docs</title></head>
<body style="font-family:system-ui;background:#0b0b0f;color:#f5f5f7;padding:2rem">
<h1>UniLive Developer Docs</h1>
<p>Open-source-ready documentation portal (local).</p>
<ul>${indexLinks}</ul>
</body></html>`,
  );
  return { ok: true, out: OUT, pages: built };
}

export async function checkDocsLinks() {
  const files = (await readdir(OUT)).filter((f) => f.endsWith('.html'));
  const missing = [];
  for (const [, file] of SECTIONS) {
    const html = file.replace(/\.md$/, '.html');
    if (!files.includes(html)) missing.push(html);
  }
  return { ok: missing.length === 0, missing, pages: files.length };
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('build-docs-portal.mjs')) {
  const built = await buildDocsPortal();
  const links = await checkDocsLinks();
  console.log(JSON.stringify({ ...built, links }, null, 2));
  if (!links.ok) process.exit(1);
}
