import { chromium } from 'playwright';

const URL = process.env.DIAG_URL || 'http://localhost:5173/';
const errors = [];
const warns = [];

const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
const ctx = await browser.newContext({ permissions: ['camera', 'microphone'] });
const page = await ctx.newPage();

page.on('console', (m) => {
  const t = m.type();
  const text = m.text();
  if (t === 'error') errors.push(text);
  else if (t === 'warning' && /error|loop|maximum|failed/i.test(text)) warns.push(text);
});
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + (e?.message || String(e))));

const t0 = Date.now();
await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

async function snapshot(label) {
  const s = await page.evaluate(() => {
    const root = document.getElementById('root');
    const boot = document.getElementById('boot-shell');
    return {
      rootChildren: root ? root.childElementCount : -1,
      bootPresent: Boolean(boot),
      bootVisible: boot ? getComputedStyle(boot).display !== 'none' && boot.offsetParent !== null : false,
      bodyText: (document.body.innerText || '').slice(0, 120).replace(/\s+/g, ' '),
    };
  });
  console.log(`[${label} @${Date.now() - t0}ms] root=${s.rootChildren} boot=${s.bootPresent}/${s.bootVisible ? 'visible' : 'hidden'} text="${s.bodyText}"`);
  return s;
}

await snapshot('t=dom');
// Poll until React mounts (root has children) or 20s
let mountedAt = -1;
for (let i = 0; i < 40; i++) {
  const s = await page.evaluate(() => document.getElementById('root')?.childElementCount ?? 0);
  if (s > 0) { mountedAt = Date.now() - t0; break; }
  await page.waitForTimeout(500);
}
console.log(mountedAt >= 0 ? `React mounted at ${mountedAt}ms` : 'React NEVER mounted within 20s');
await page.waitForTimeout(2500);
await snapshot('t=after');

// Try to find a Reels nav control
const reels = await page.evaluate(() => {
  const els = Array.from(document.querySelectorAll('button,[role="button"],a'));
  const hit = els.find((e) => /reels/i.test(e.getAttribute('aria-label') || '') || /^reels$/i.test((e.textContent || '').trim()));
  return hit ? { found: true, label: hit.getAttribute('aria-label') || hit.textContent?.trim() } : { found: false };
});
console.log('Reels nav:', JSON.stringify(reels));

console.log('--- console errors (' + errors.length + ') ---');
console.log(errors.slice(0, 15).join('\n'));
console.log('--- notable warns (' + warns.length + ') ---');
console.log(warns.slice(0, 8).join('\n'));

await browser.close();
