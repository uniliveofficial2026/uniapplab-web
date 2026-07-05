#!/usr/bin/env node
/**
 * Render carousel demo thumbs for SDK effects that ship without preview.png.
 * Uses DeepAR processImage + takeScreenshot with a stock demo portrait.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execSync } from 'node:child_process';
import { chromium } from 'playwright';
import { getAppRoot, readEnvFile } from './resolveProjectEnv.mjs';

const appRoot = getAppRoot(import.meta.dirname);
const publicDir = path.join(appRoot, 'public');
const vendorThumbsDir = path.join(appRoot, 'vendor/deepar-thumbs');
const deeparRoot = path.join(appRoot, 'node_modules/deepar');

const QUICKSTART =
  'https://raw.githubusercontent.com/DeepARSDK/quickstart-web-js-npm/main/public';

/** SDK built-ins that need a rendered face demo (not texture atlases). */
const RENDER_TARGETS = [
  { effectId: 'none', mode: 'none' },
  {
    effectId: 'background_replacement',
    mode: 'background_replacement',
    effectPath: 'deepar-resources/effects/background_replacement.deepar',
  },
  { effectId: 'aviators', mode: 'effect', effectPath: 'deepar-resources/effects/aviators' },
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
      } else if (url.pathname.startsWith('/effects/')) {
        filePath = path.join(publicDir, url.pathname.slice(1));
      } else if (url.pathname === '/demo-face.png') {
        filePath = path.join(vendorThumbsDir, 'demo-face.png');
      } else if (url.pathname === '/replacement-bg.jpg') {
        filePath = path.join(vendorThumbsDir, 'replacement-bg.jpg');
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

function ensureReplacementBackground() {
  fs.mkdirSync(vendorThumbsDir, { recursive: true });
  const dest = path.join(vendorThumbsDir, 'replacement-bg.jpg');
  const beachUrl =
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=512&h=512&q=80';
  if (!fs.existsSync(dest) || fs.statSync(dest).size < 30_000) {
    execSync(`curl -fsSL "${beachUrl}" -o "${dest}"`, { stdio: 'pipe' });
  }
  return dest;
}

function execDownload(url, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  execSync(`curl -fsSL "${url}" -o "${dest}"`, { stdio: 'pipe' });
}

async function renderOne(server, baseUrl, licenseKey, target) {
  const browser = await chromium.launch({
    headless: process.env.DEEPAR_RENDER_HEADED === '1' ? false : true,
    args: [
      '--enable-unsafe-swiftshader',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
    ],
  });
  const page = await browser.newPage({ viewport: { width: 640, height: 640 } });
  page.on('console', (msg) => {
    console.log(`[browser] ${msg.type()}: ${msg.text()}`);
  });
  page.on('requestfailed', (req) => {
    console.warn(`[browser] request failed: ${req.url()} (${req.failure()?.errorText})`);
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      console.warn(`[browser] ${res.status()} ${res.url()}`);
    }
  });
  page.on('pageerror', (err) => {
    console.error(`[browser] pageerror: ${err.message}`);
  });

  try {
    await page.addInitScript(
      ({ key, target, portraitUrl, backgroundImageUrl }) => {
        window.__deeparRenderConfig = {
          licenseKey: key,
          mode: target.mode,
          effectPath: target.effectPath ? `/${target.effectPath}` : null,
          portraitUrl,
          backgroundImageUrl,
        };
      },
      {
        key: licenseKey,
        target,
        portraitUrl: `${baseUrl}/demo-face.png`,
        backgroundImageUrl: target.backgroundImagePath
          ? `${baseUrl}/replacement-bg.jpg`
          : 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="100%" height="100%" fill="white"/></svg>',
      },
    );

    await page.goto(`${baseUrl}/render.html`, { waitUntil: 'networkidle' });

    await page.waitForFunction(() => window.__deeparRenderDone === true, null, {
      timeout: 120_000,
    });

    const renderError = await page.evaluate(() => window.__deeparRenderError);
    const renderStep = await page.evaluate(() => window.__deeparRenderStep);
    if (renderError) {
      throw new Error(`${renderError}${renderStep ? ` (step: ${renderStep})` : ''}`);
    }

    const result = await page.evaluate(() => window.__deeparRenderResult);
    if (!result || typeof result !== 'string' || !result.startsWith('data:image/')) {
      throw new Error(`Screenshot missing for ${target.effectId}`);
    }

    const base64 = result.replace(/^data:image\/\w+;base64,/, '');
    const out = path.join(vendorThumbsDir, `${target.effectId}.png`);
    const bytes = Buffer.from(base64, 'base64');
    if (bytes.length < 20_000) {
      throw new Error(`Rendered ${target.effectId} preview looks empty (${bytes.length} bytes)`);
    }
    fs.writeFileSync(out, bytes);
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
  ensureReplacementBackground();

  const server = createStaticServer();
  await new Promise((resolve) => server.listen(0, 'localhost', resolve));
  const { port } = server.address();
  const baseUrl = `http://localhost:${port}`;

  try {
    for (const target of RENDER_TARGETS) {
      if (target.effectPath) {
        const effectFile = path.join(publicDir, target.effectPath);
        if (!fs.existsSync(effectFile)) {
          console.warn(`[deepar] Skip render for ${target.effectId} (effect file missing)`);
          continue;
        }
      }
      try {
        await renderOne(server, baseUrl, licenseKey, target);
      } catch (err) {
        console.warn(`[deepar] Could not render ${target.effectId} preview: ${err.message}`);
      }
    }
  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error('[deepar] SDK preview render failed:', err.message);
  process.exit(1);
});
