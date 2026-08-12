#!/usr/bin/env node
/**
 * Generate a UniLive’s Meshy review model (preview → optional refine → download GLB).
 *
 * Usage (from repo root):
 *   set -a && source .env.meshy.local && set +a
 *   node tools/character-pipeline/meshy/generate-review-model.mjs \
 *     --prompt "UniLive’s mascot character, friendly, A-pose, game-ready" \
 *     [--refine] [--name unilives-mascot-v1]
 *
 * Never prints MESHY_API_KEY.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../..');
const OUT_DIR = path.join(ROOT, 'assets-source/unilives-character/references/meshy-reviews');
const API = 'https://api.meshy.ai/openapi/v2/text-to-3d';

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function requireKey() {
  const key = process.env.MESHY_API_KEY?.trim();
  if (!key) {
    console.error('Meshy key missing. Load with: set -a; source .env.meshy.local; set +a');
    process.exit(1);
  }
  if (!key.startsWith('msy_')) {
    console.error('MESHY_API_KEY format looks invalid (expected msy_… prefix).');
    process.exit(1);
  }
  return key;
}

async function api(key, method, url, body) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg = json?.message || json?.error || text.slice(0, 300);
    throw new Error(`Meshy ${method} ${url} → ${res.status}: ${msg}`);
  }
  return json;
}

async function poll(key, taskId) {
  const url = `${API}/${taskId}`;
  for (;;) {
    const task = await api(key, 'GET', url);
    const status = task.status || task?.result?.status;
    const progress = task.progress ?? task?.result?.progress ?? 0;
    process.stdout.write(`\r[${taskId.slice(0, 8)}…] ${status} ${progress}%   `);
    if (status === 'SUCCEEDED') {
      process.stdout.write('\n');
      return task;
    }
    if (status === 'FAILED' || status === 'CANCELED') {
      process.stdout.write('\n');
      throw new Error(`Task ${taskId} ${status}: ${task.task_error?.message || 'unknown'}`);
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
}

function modelUrl(task) {
  return (
    task?.model_urls?.glb ||
    task?.result?.model_urls?.glb ||
    task?.model_url ||
    null
  );
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  return dest;
}

async function main() {
  const key = requireKey();
  const prompt =
    arg('--prompt') ||
    "UniLive's brand mascot character, friendly stylized humanoid, clean silhouette, A-pose, game-ready, not photoreal celebrity";
  const name = arg('--name', `unilives-review-${new Date().toISOString().slice(0, 10)}`);
  const doRefine = hasFlag('--refine');

  console.log('Creating Meshy preview…');
  const previewCreate = await api(key, 'POST', API, {
    mode: 'preview',
    prompt,
    // Meshy currently accepts art_style: realistic for this endpoint.
    art_style: 'realistic',
    should_remesh: true,
    target_polycount: 40000,
    pose_mode: 'a-pose',
    target_formats: ['glb'],
  });
  const previewId = previewCreate.result || previewCreate.id;
  if (!previewId) throw new Error('No preview task id returned');
  console.log(`Preview task: ${previewId}`);
  const preview = await poll(key, previewId);

  let finalTask = preview;
  let stage = 'preview';

  if (doRefine) {
    console.log('Creating Meshy refine…');
    const refineCreate = await api(key, 'POST', API, {
      mode: 'refine',
      preview_task_id: previewId,
      enable_pbr: true,
      target_formats: ['glb'],
    });
    const refineId = refineCreate.result || refineCreate.id;
    console.log(`Refine task: ${refineId}`);
    finalTask = await poll(key, refineId);
    stage = 'refine';
  }

  const glb = modelUrl(finalTask);
  if (!glb) throw new Error('No GLB URL on succeeded task');

  const outGlb = path.join(OUT_DIR, `${name}-${stage}.glb`);
  const outMeta = path.join(OUT_DIR, `${name}-${stage}.json`);
  await download(glb, outGlb);
  fs.writeFileSync(
    outMeta,
    JSON.stringify(
      {
        brand: "UniLive’s",
        name,
        stage,
        prompt,
        preview_task_id: previewId,
        created_at: new Date().toISOString(),
        output: path.relative(ROOT, outGlb),
      },
      null,
      2,
    ),
  );

  console.log(`Saved: ${path.relative(ROOT, outGlb)}`);
  console.log('Next: open tools/character-pipeline/meshy/viewer/index.html to inspect in 360°.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
