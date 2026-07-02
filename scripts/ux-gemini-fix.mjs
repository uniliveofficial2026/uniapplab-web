#!/usr/bin/env node
/**
 * Optional Gemini pass — turns UX learning + health into safe auto-fixes and feature backlog.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEARNING = path.join(ROOT, '.local/ux-learning.json');
const BACKLOG = path.join(ROOT, '.local/ux-feature-backlog.json');
const HANDOFF_LOG = path.join(ROOT, '.local/handoff-queue.jsonl');
const FIX_LOG = path.join(ROOT, '.local/ux-agent-fixes.jsonl');

const SAFE_FIX_FILES = new Set([
  'artifacts/instacollab/src/index.css',
  'artifacts/instacollab/src/lib/selfHeal.ts',
  'artifacts/instacollab/src/lib/safe.ts',
  'artifacts/instacollab/src/lib/uxTelemetry.ts',
]);

function readEnvKey(name) {
  for (const file of [path.join(ROOT, '.env'), path.join(ROOT, 'artifacts/instacollab/.env')]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(new RegExp(`^${name}=(.*)$`));
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    }
  }
  return process.env[name] || '';
}

async function callGemini(prompt) {
  const key = readEnvKey('GEMINI_API_KEY') || readEnvKey('VITE_GEMINI_API_KEY');
  if (!key) return null;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
      }),
    },
  );

  if (!res.ok) return null;
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === 'string' ? text : null;
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function applyFix(fix) {
  const rel = fix.file?.replace(/^\//, '');
  if (!rel || !SAFE_FIX_FILES.has(rel)) return false;
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return false;
  const content = fs.readFileSync(abs, 'utf8');
  if (!fix.search || !content.includes(fix.search)) return false;
  const next = content.replace(fix.search, fix.replace ?? '');
  if (next === content) return false;
  fs.writeFileSync(abs, next);
  fs.appendFileSync(FIX_LOG, `${JSON.stringify({ t: Date.now(), file: rel, reason: fix.reason })}\n`);
  return true;
}

export async function runUxGeminiFix() {
  if (!fs.existsSync(LEARNING)) return { applied: 0, features: 0 };

  const learning = JSON.parse(fs.readFileSync(LEARNING, 'utf8'));
  const pendingHandoff = fs.existsSync(HANDOFF_LOG)
    ? fs.readFileSync(HANDOFF_LOG, 'utf8').split('\n').filter(Boolean).slice(-20).map((l) => {
        try { return JSON.parse(l); } catch { return null; }
      }).filter(Boolean)
    : [];

  const prompt = `You are the silent handoff ML agent for InstaCollab (React + Vite social app).

UX learning:
${JSON.stringify(learning, null, 2)}

Pending handoff tasks from app (errors, media, cloud data, UI friction):
${JSON.stringify(pendingHandoff, null, 2)}

Your job: infer what users need, fix safe issues, and queue feature work.

Return ONLY valid JSON:
{
  "fixes": [
    { "file": "artifacts/instacollab/src/index.css", "search": "exact snippet", "replace": "replacement", "reason": "why" }
  ],
  "features": [
    { "title": "short title", "description": "what users want based on behavior", "priority": "low|medium|high|critical", "screens": ["home"] }
  ]
}

Rules:
- fixes ONLY for CSS overflow, safe fallbacks, aria labels, mobile layout, cloud sync hooks — max 3 fixes
- features infer user needs from rage taps, dwell time, errors, cross-user data issues (max 5)
- if handoff tasks mention posts/cloud/supabase, prioritize data-flow fixes in features list
- never include secrets or API keys
- search/replace must be minimal and exact`;

  const raw = await callGemini(prompt);
  if (!raw) return { applied: 0, features: 0 };

  const plan = extractJson(raw);
  if (!plan) return { applied: 0, features: 0 };

  let applied = 0;
  for (const fix of plan.fixes ?? []) {
    if (applyFix(fix)) applied += 1;
  }

  const features = plan.features ?? [];
  if (features.length) {
    fs.mkdirSync(path.dirname(BACKLOG), { recursive: true });
    const prev = fs.existsSync(BACKLOG) ? JSON.parse(fs.readFileSync(BACKLOG, 'utf8')) : [];
    fs.writeFileSync(BACKLOG, `${JSON.stringify([...prev, ...features].slice(-100), null, 2)}\n`);
  }

  return { applied, features: features.length };
}

function isMainModule() {
  const entry = process.argv[1];
  if (!entry) return false;
  return fileURLToPath(import.meta.url) === path.resolve(entry);
}

if (isMainModule()) {
  runUxGeminiFix().then((r) => {
    console.log(`[ux-gemini] applied ${r.applied} fix(es), ${r.features} feature idea(s)`);
  });
}
