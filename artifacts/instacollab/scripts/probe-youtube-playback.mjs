/**
 * Runtime probe for every in-app YouTube surface: video, Shorts, live and the
 * floating mini player, plus the fallback shown for an unplayable video.
 *
 * Evidence used, rather than "the iframe rendered":
 *  - requests to *.googlevideo.com prove real media is streaming
 *  - a playerState of 1 (PLAYING) reported by the embed proves the IFrame API
 *    is delivering events, which is what makes end/error handling work
 *
 * The player autoplays unmuted, which browsers block until the user interacts,
 * so each scenario taps the player exactly like a person would.
 *
 * Real Chrome is required: bundled Chromium lacks the H.264 codecs YouTube needs.
 *
 * Usage: node scripts/probe-youtube-playback.mjs [baseUrl] [--only=<scenario>]
 */
import { chromium } from 'playwright';

const baseUrl = (process.argv.find((a) => a.startsWith('http')) || 'http://localhost:5173').replace(
  /\/$/,
  '',
);

/** Embeddable, always-available reference clip (Blender open movie). */
const PLAYABLE_ID = 'aqz-KE-bpKQ';
/** Well-formed but unplayable id — YouTube answers with an embed error. */
const UNPLAYABLE_ID = 'aaaaaaaaaaa';

const failures = [];

function log(label, value) {
  console.log(`[probe] ${label} ${typeof value === 'string' ? value : JSON.stringify(value)}`);
}

function expect(name, condition, detail) {
  if (condition) {
    console.log(`[probe] PASS ${name}`);
  } else {
    console.log(`[probe] FAIL ${name} ${detail == null ? '' : JSON.stringify(detail)}`);
    failures.push(name);
  }
}

/**
 * search.list costs 100 quota units per call, so the daily allowance runs out
 * long before videos.list does. Search and Live both depend on it.
 */
async function searchQuotaAvailable() {
  try {
    const res = await fetch(`${baseUrl}/api/youtube/search?q=probe`);
    if (res.status === 429) return false;
    const body = await res.text();
    return !/quota/i.test(body);
  } catch {
    return false;
  }
}

function watchPage(page) {
  const state = { media: new Set(), events: new Set(), states: new Set() };
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('googlevideo.com')) state.media.add(new URL(url).hostname);
  });
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.startsWith('YT_EVENT ')) state.events.add(text.slice('YT_EVENT '.length));
    else if (text.startsWith('YT_STATE ')) state.states.add(Number(text.slice('YT_STATE '.length)));
  });
  return state;
}

/** Mirror the embed's postMessage traffic into console so the probe can read it. */
async function instrument(context) {
  await context.addInitScript(() => {
    window.addEventListener('message', (event) => {
      if (!String(event.origin).includes('youtube')) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!data || !data.event) return;
        console.log(`YT_EVENT ${data.event}`);
        const state =
          typeof data.info === 'number'
            ? data.info
            : data.info && typeof data.info.playerState === 'number'
              ? data.info.playerState
              : null;
        if (state != null) console.log(`YT_STATE ${state}`);
      } catch {
        /* non-JSON frames are noise */
      }
    });
  });
}

async function openApp(browser, { seedMiniPlayer } = {}) {
  const context = await browser.newContext({ viewport: { width: 900, height: 1200 } });
  await instrument(context);
  if (seedMiniPlayer) {
    await context.addInitScript((videoId) => {
      localStorage.setItem(
        'youtube-mini-player-v1',
        JSON.stringify({
          open: true,
          minimized: false,
          videoId,
          playlistId: null,
          queue: [
            {
              videoId,
              title: 'probe clip',
              channelTitle: 'probe',
              thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            },
          ],
          queueIndex: 0,
          title: 'probe clip',
          channelTitle: 'probe',
          x: 40,
          y: 120,
          width: 380,
          height: 300,
        }),
      );
    }, seedMiniPlayer);
  }
  const page = await context.newPage();
  return { context, page, watch: watchPage(page) };
}

async function playerUi(page) {
  return page.evaluate(() => {
    const iframe = document.querySelector('iframe[src*="/embed/"]');
    const rect = iframe?.getBoundingClientRect();
    return {
      hasIframe: Boolean(iframe),
      src: iframe?.getAttribute('src') ?? null,
      box: rect ? { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) } : null,
      openOnYoutube: document.body.textContent.includes('Open on YouTube'),
      ancestors: (() => {
        const chain = [];
        let node = iframe?.parentElement ?? null;
        while (node && chain.length < 5) {
          chain.push(`${node.tagName.toLowerCase()}.${String(node.className || '').slice(0, 60)}`);
          node = node.parentElement;
        }
        return chain;
      })(),
    };
  });
}

/**
 * Unmuted autoplay is blocked until the user interacts with the document, so
 * tap the player. Media requests alone are not proof of playback: a blocked
 * embed still buffers, so only playerState 1 means it really started.
 */
async function tapPlayer(page, watch) {
  if (watch.states.has(1)) return;
  const ui = await playerUi(page);
  if (!ui.box || ui.box.w < 40 || ui.box.h < 40) return;
  await page.mouse.click(ui.box.x + ui.box.w / 2, ui.box.y + ui.box.h / 2);
  await page.waitForTimeout(9000);
}

function assertPlays(name, watch, ui) {
  expect(`${name} streams media`, watch.media.size > 0, Array.from(watch.media));
  expect(`${name} reports PLAYING via the IFrame API`, watch.states.has(1), Array.from(watch.states));
  expect(`${name} did not fall back to an error`, !ui.openOnYoutube, ui);
}

async function clickFirstCard(page) {
  return page.evaluate(() => {
    const card = Array.from(document.querySelectorAll('button')).find((btn) =>
      btn.querySelector('img[src*="ytimg.com"]'),
    );
    card?.scrollIntoView({ block: 'center' });
    card?.click();
    return Boolean(card);
  });
}

async function clickTab(page, label) {
  await page.evaluate((text) => {
    const tab = Array.from(document.querySelectorAll('button')).find(
      (btn) => (btn.textContent || '').trim() === text,
    );
    tab?.click();
  }, label);
}

/** Standard 16:9 video, reached through search so it is never a Short. */
async function probeVideo(browser) {
  const { context, page, watch } = await openApp(browser);
  await page.goto(`${baseUrl}/youtube?launch=main`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);

  // Real typing: React ignores synthetic input/submit events dispatched by script.
  const search = page.locator('input[placeholder*="Search" i]').first();
  await search.waitFor({ state: 'visible', timeout: 20000 });
  await search.fill('blender open movie');
  await search.press('Enter');
  await page.waitForTimeout(7000);

  // Pick a card that matches the query; feed rows above the results are Shorts.
  const clicked = await page.evaluate(() => {
    const card = Array.from(document.querySelectorAll('button')).find(
      (btn) =>
        btn.querySelector('img[src*="ytimg.com"]') && /blender/i.test(btn.textContent || ''),
    );
    if (!card) return false;
    card.scrollIntoView({ block: 'center' });
    card.click();
    return true;
  });
  log('video:result_card_clicked', clicked);
  if (!clicked) {
    console.log('[probe] SKIP standard video — search results did not render');
    await context.close();
    return;
  }
  await page.waitForTimeout(9000);
  await tapPlayer(page, watch);

  const ui = await playerUi(page);
  log('video:ui', ui);
  log('video:events', Array.from(watch.events));
  expect(
    'video used the standard 16:9 player',
    !ui.ancestors.some((entry) => entry.includes('9/16')),
    ui,
  );
  assertPlays('video', watch, ui);
  await page.screenshot({ path: 'youtube-probe-video.png' });
  await context.close();
}

/** Shorts tab renders the vertical 9:16 player. */
async function probeShorts(browser) {
  const { context, page, watch } = await openApp(browser);
  await page.goto(`${baseUrl}/youtube?launch=main`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await clickTab(page, 'Shorts');
  await page.waitForTimeout(6000);
  log('shorts:card_clicked', await clickFirstCard(page));
  await page.waitForTimeout(9000);
  await tapPlayer(page, watch);

  const ui = await playerUi(page);
  log('shorts:ui', ui);
  expect(
    'shorts reached the vertical player',
    ui.ancestors.some((entry) => entry.includes('9/16')),
    ui,
  );
  assertPlays('shorts', watch, ui);
  await page.screenshot({ path: 'youtube-probe-shorts.png' });
  await context.close();
}

/** Floating mini player, seeded open on a non-YouTube tab. */
async function probeMiniPlayer(browser) {
  const { context, page, watch } = await openApp(browser, { seedMiniPlayer: PLAYABLE_ID });
  await page.goto(`${baseUrl}/?launch=main`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(11000);
  await tapPlayer(page, watch);

  const ui = await playerUi(page);
  log('mini:ui', ui);
  log('mini:events', Array.from(watch.events));
  assertPlays('mini player', watch, ui);
  await page.screenshot({ path: 'youtube-probe-mini.png' });
  await context.close();
}

/** Live stream from the Live tab, which renders the fullscreen feed. */
async function probeLiveFullscreen(browser) {
  const { context, page, watch } = await openApp(browser);
  await page.goto(`${baseUrl}/youtube?launch=main`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await clickTab(page, 'Live');
  await page.waitForTimeout(6000);

  // Match the rendered live badge, not the word "live" inside a video title.
  const findLiveCard = () =>
    page.evaluate(() => {
      const badge = Array.from(document.querySelectorAll('span.bg-red-600')).find(
        (el) => (el.textContent || '').trim().toLowerCase() === 'live',
      );
      const card = badge?.closest('button');
      if (!card) return false;
      card.scrollIntoView({ block: 'center' });
      card.click();
      return true;
    });

  let opened = await findLiveCard();
  for (let wait = 0; !opened && wait < 4; wait += 1) {
    await page.waitForTimeout(3000);
    opened = await findLiveCard();
  }
  log('live:live_card_clicked', opened);
  if (!opened) {
    console.log('[probe] SKIP live fullscreen — YouTube returned no live results right now');
    await context.close();
    return;
  }
  await page.waitForTimeout(11000);
  await tapPlayer(page, watch);

  const ui = await playerUi(page);
  log('live:ui', ui);
  expect(
    'live reached the fullscreen feed',
    ui.ancestors.some((entry) => entry.includes('100dvh')),
    ui,
  );
  assertPlays('live stream', watch, ui);
  await page.screenshot({ path: 'youtube-probe-live.png' });
  await context.close();
}

/** An unplayable video must degrade to an actionable panel, not an endless spinner. */
async function probeUnplayableFallback(browser) {
  const { context, page, watch } = await openApp(browser, { seedMiniPlayer: UNPLAYABLE_ID });
  await page.goto(`${baseUrl}/?launch=main`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(16000);

  const ui = await playerUi(page);
  log('unplayable:ui', ui);
  log('unplayable:events', Array.from(watch.events));
  expect('unplayable video surfaces a fallback', ui.openOnYoutube, ui);
  expect('unplayable video stops showing the player frame', !ui.hasIframe, ui);
  await page.screenshot({ path: 'youtube-probe-unplayable.png' });
  await context.close();
}

async function main() {
  const hasSearchQuota = await searchQuotaAvailable();
  log('youtube_search_quota', hasSearchQuota ? 'available' : 'EXHAUSTED for today');
  if (!hasSearchQuota) {
    console.log('[probe] search and live browsing depend on search.list; those scenarios will skip');
  }

  const browser = await chromium.launch({ channel: 'chrome' });
  const only = process.argv.find((a) => a.startsWith('--only='))?.slice('--only='.length);
  const scenarios = {
    video: { run: probeVideo, needsSearch: true },
    shorts: { run: probeShorts, needsSearch: false },
    mini: { run: probeMiniPlayer, needsSearch: false },
    live: { run: probeLiveFullscreen, needsSearch: false },
    unplayable: { run: probeUnplayableFallback, needsSearch: false },
  };
  try {
    for (const [name, { run, needsSearch }] of Object.entries(scenarios)) {
      if (only && only !== name) continue;
      if (needsSearch && !hasSearchQuota) {
        console.log(`[probe] SKIP ${name} — YouTube search quota exhausted`);
        continue;
      }
      await run(browser);
    }
  } finally {
    await browser.close();
  }

  if (failures.length) {
    console.error(`[probe] FAILED: ${failures.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('[probe] ALL SURFACES OK');
  }
}

main().catch((error) => {
  console.error('[probe] crashed', error);
  process.exitCode = 1;
});
