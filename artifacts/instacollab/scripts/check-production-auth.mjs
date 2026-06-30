#!/usr/bin/env node
/**
 * Compare live site Supabase project vs local .env (catches Vercel env mismatch).
 * Usage: pnpm run auth:check:prod
 */
import {
  findEnvFile,
  readEnvFile,
  supabaseProjectRefFromEnv,
} from './resolveProjectEnv.mjs';

const SITES = ['https://uniapplab.com', 'https://app.uniapplab.com'];

async function fetchMainBundleUrl(site) {
  const res = await fetch(site, { redirect: 'follow' });
  const html = await res.text();
  const match = html.match(/src="(\/assets\/index-[^"]+\.js)"/);
  if (!match) return null;
  return new URL(match[1], site).toString();
}

async function fetchRuntimeConfigRef(site) {
  try {
    const res = await fetch(new URL('/supabase-config.json', site), { redirect: 'follow' });
    if (!res.ok) return null;
    const data = await res.json();
    const url = String(data.supabaseUrl || '');
    const match = url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

async function extractSupabaseRef(bundleUrl) {
  const res = await fetch(bundleUrl, { redirect: 'follow' });
  const js = await res.text();
  const match = js.match(/https:\/\/([a-z0-9]+)\.supabase\.co/);
  return match?.[1] ?? null;
}

async function probeGoogleEnabled(url, key) {
  const base = url.replace(/\/$/, '');
  const res = await fetch(`${base}/auth/v1/settings`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return { ok: false, status: res.status };
  const data = await res.json();
  return { ok: true, google: Boolean(data?.external?.google) };
}

async function main() {
  const envPath = findEnvFile(import.meta.dirname);
  const env = readEnvFile(envPath);
  const localRef = supabaseProjectRefFromEnv(envPath);
  const localUrl = (env.VITE_SUPABASE_URL || '').trim();
  const localKey = env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

  console.log('');
  console.log('Production auth probe');
  console.log('───────────────────');
  console.log(`  Local .env project: ${localRef ?? '(not set)'}`);

  let exitCode = 0;

  for (const site of SITES) {
    try {
      const bundleUrl = await fetchMainBundleUrl(site);
      if (!bundleUrl) {
        console.log(`  ✗ ${site}: could not find app bundle (not the React app?)`);
        continue;
      }
      const liveRef = await extractSupabaseRef(bundleUrl);
      const runtimeRef = await fetchRuntimeConfigRef(site);
      console.log(`  • ${site} → bundle project: ${liveRef ?? 'unknown'}`);
      if (runtimeRef) {
        console.log(`    runtime /supabase-config.json → ${runtimeRef}`);
      } else {
        console.log('    ✗ missing /supabase-config.json (deploy latest build to fix Google OAuth)');
      }

      const effectiveRef = runtimeRef ?? liveRef;

      if (localRef && effectiveRef && localRef !== effectiveRef) {
        exitCode = 1;
        console.log(
          `    ✗ MISMATCH: effective project ${effectiveRef} vs local .env ${localRef}.`,
        );
      } else if (localRef && effectiveRef && localRef === effectiveRef) {
        console.log('    ✓ Effective project matches local .env');
      }

      if (effectiveRef && localUrl && localKey && effectiveRef === localRef) {
        const probe = await probeGoogleEnabled(localUrl, localKey);
        if (probe.ok && !probe.google) {
          exitCode = 1;
          console.log('    ✗ Google provider is OFF on this Supabase project');
        } else if (probe.ok && probe.google) {
          console.log('    ✓ Google provider enabled on Supabase');
        }
      }
    } catch (err) {
      console.log(`  ✗ ${site}: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log('');
  if (exitCode !== 0) {
    console.log('  Fix: deploy latest build (includes public/supabase-config.json), then verify:');
    console.log('    pnpm run auth:check:prod');
    console.log('  Also set Vercel Production env to kgiaflmukkguzjtmcuqd and redeploy when possible.');
  }
  console.log('');
  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
