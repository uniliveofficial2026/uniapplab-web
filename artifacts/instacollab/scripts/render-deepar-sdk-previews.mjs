#!/usr/bin/env node
/**
 * Render carousel demo thumbs for SDK effects that ship without preview.png.
 * Uses DeepAR processImage + takeScreenshot with a stock demo portrait.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { getAppRoot, readEnvFile } from './resolveProjectEnv.mjs';

const appRoot = getAppRoot(import.meta.dirname);
const publicDir = path.join(appRoot, 'public');
const vendorThumbsDir = path.join(appRoot, 'vendor/deepar-thumbs');
const require = createRequire(path.join(appRoot, 'package.json'));
const deeparRoot = path.dirname(require.resolve('deepar/package.json'));

const QUICKSTART =
  'https://raw.githubusercontent.com/DeepARSDK/quickstart-web-js-npm/main/public';

/** SDK built-ins that need a rendered face demo (not texture atlases). */
const RENDER_TARGETS = [
  { effectId: 'aviators', effectPath: 'deepar-resources/effects/aviators' },
];

function contentType(filePath) {
  if (filePath.endsWith('.js')) return 'application/javascript';
  if (filePath.endsWith('.wasm')) return 'application/wasm';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  if (filePath.endsWith('.webp')) return 'image/webp';
  if (filePath.endsWith('.html')) return 'text/html';
  return 'application/octet-stream';
}

function createStaticServer() {
  return http.createServer((req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      let filePath = null;

      if (url.pathname === '/render.html') {
        filePath = path.join(appRoot, 'scripts/templates/deepar-sdk-preview.html');
      } else if (url.pathname.startsWith('/deepar-resources/')) {
        filePath = path.join(publicDir, url.pathname);
      } else if (url.pathname.startsWith('/deepar/')) {
        filePath = path.join(deeparRoot, url.pathname.replace('/deepar/', ''));
      } else if (url.pathname === '/demo-face.png') {
        filePath = path.join(vendorThumbsDir, 'demo-face.png');
      }

      if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      res.writeHead(200, { 'Content-Type': contentType(filePath) });
      fs.createReadStream(filePath).pipe(res);
    } catch (err) {
      res.writeHead(500);
      res.end(String(err));
    }
  });
}

function ensureDemoFace() {
  fs.mkdirSync(vendorThumbsDir, { recursive: true });
  const dest = path.join(vendorThumbsDir, 'demo-face.png');
  if (!fs.existsSync(dest)) {
    execDownload(`${QUICKSTART}/thumbs/makeup.png`, dest);
  }
  return dest;
}

function execDownload(url, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const { execSync } = require('node:child_process');
  execSync(`curl -fsSL "${url}" -o "${dest}"`, { stdio: 'pipe' });
}

async function renderOne(server, baseUrl, licenseKey, target) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 640, height: 640 } });

  try {
    await page.goto(`${baseUrl}/render.html`, { waitUntil: 'networkidle' });
    await page.evaluate(
      ({ key, effectPath, portraitUrl }) => {
        window.__deeparRenderConfig = { licenseKey: key, effectPath, portraitUrl };
      },
      {
        key: licenseKey,
        effectPath: `/${target.effectPath}`,
        portraitUrl: `${baseUrl}/demo-face.png`,
      },
    );

    await page.waitForFunction(() => window.__deeparRenderDone === true, null, {
      timeout: 120_000,
    });

    const result = await page.evaluate(() => window.__deeparRenderResult);
    if (!result || typeof result !== 'string' || !result.startsWith('data:image/')) {
      throw new Error(`Screenshot missing for ${target.effectId}`);
    }

    const base64 = result.replace(/^data:image\/\w+;base64,/, '');
    const out = path.join(vendorThumbsDir, `${target.effectId}.png`);
    fs.writeFileSync(out, Buffer.from(base64, 'base64'));
    console.log(`[deepar] Rendered ${target.effectId} demo → vendor/deepar-thumbs/${target.effectId}.png`);
    return out;
  } finally {
    await browser.close();
  }
}

async function main() {
  const env = readEnvFile();
  const licenseKey =
    process.env.VITE_DEEPAR_LICENSE_KEY?.trim() || env.VITE_DEEPAR_LICENSE_KEY?.trim() || '';

  if (!licenseKey || /your|xxxx|placeholder/i.test(licenseKey)) {
    console.warn('[deepar] Skipping SDK preview render (VITE_DEEPAR_LICENSE_KEY not set)');
    return;
  }

  if (!fs.existsSync(path.join(publicDir, 'deepar-resources'))) {
    console.warn('[deepar] Skipping SDK preview render (run deepar:install first)');
    return;
  }

  ensureDemoFace();

  const server = createStaticServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    for (const target of RENDER_TARGETS) {
      const effectFile = path.join(publicDir, target.effectPath);
      if (!fs.existsSync(effectFile)) {
        console.warn(`[deepar] Skip render for ${target.effectId} (effect file missing)`);
        continue;
      }
      await renderOne(server, baseUrl, licenseKey, target);
    }
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('[deepar] SDK preview render failed:', err.message);
  process.exit(1);
});
