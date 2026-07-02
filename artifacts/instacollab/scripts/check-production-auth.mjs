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

async function probeAuthSettings(url, key) {
  const base = url.replace(/\/$/, '');
  const res = await fetch(`${base}/auth/v1/settings`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return { ok: false, status: res.status };
  const data = await res.json();
  return {
    ok: true,
    google: Boolean(data?.external?.google),
    email: Boolean(data?.external?.email),
    mailerAutoconfirm: Boolean(data?.mailer_autoconfirm),
  };
}

/** Detect Supabase Auth OAuth upstream down (Envoy 503 + connect error 111). */
async function probeAuthAuthorize(url) {
  const base = url.replace(/\/$/, '');
  const res = await fetch(
    `${base}/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fexample.com`,
    { redirect: 'manual' },
  );
  if (res.status !== 503) return { ok: true, status: res.status };
  const text = await res.text().catch(() => '');
  const upstreamDown =
    text.includes('upstream connect error') ||
    text.includes('delayed connect error') ||
    text.includes('111');
  return { ok: !upstreamDown, status: res.status, upstreamDown, snippet: text.slice(0, 120) };
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

  if (localUrl) {
    const authorizeProbe = await probeAuthAuthorize(localUrl);
    if (!authorizeProbe.ok && authorizeProbe.upstreamDown) {
      exitCode = 1;
      console.log(`  ✗ Supabase Auth OAuth endpoint is DOWN for ${localRef} (503 / connect error 111)`);
      console.log('      → Project may be deleted or paused. Point .env at an ACTIVE project in your Supabase org.');
    } else if (authorizeProbe.ok) {
      console.log(`  ✓ Supabase Auth OAuth endpoint reachable (${localRef})`);
      if (authorizeProbe.status === 400) {
        console.log('    (400 = provider not enabled yet — enable Google in Supabase → Authentication → Providers)');
      }
    }
  }

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
      } else       if (localRef && effectiveRef && localRef === effectiveRef) {
        console.log('    ✓ Effective project matches local .env');
      }
    } catch (err) {
      console.log(`  ✗ ${site}: ${err instanceof Error ? err.message : err}`);
    }
  }

  if (localUrl && localKey && localRef) {
    const probe = await probeAuthSettings(localUrl, localKey);
    if (probe.ok && !probe.google) {
      exitCode = 1;
      console.log('  ✗ Google provider is OFF on this Supabase project');
      console.log('      → Supabase Dashboard → Authentication → Providers → Google → enable');
      console.log(`      → Add callback https://${localRef}.supabase.co/auth/v1/callback in Google Cloud`);
      console.log('      → Run: pnpm run oauth:setup');
    } else if (probe.ok && probe.google) {
      console.log('  ✓ Google provider enabled on Supabase');
    }

    if (probe.ok && !probe.email) {
      exitCode = 1;
      console.log('  ✗ Email provider is OFF — OTP cannot be sent');
      console.log('      → Supabase Dashboard → Authentication → Providers → Email → enable');
    } else if (probe.ok && probe.email) {
      console.log('  ✓ Email provider enabled on Supabase');
      console.log('  ⚠ Email OTP delivery to Gmail requires:');
      console.log('      1. Magic Link template must include {{ .Token }} (not only a link)');
      console.log('      2. Custom SMTP (Resend/SendGrid) — default Supabase mail is often blocked');
      console.log('      → Run: pnpm run email-otp:setup');
      console.log('      → Or: SUPABASE_ACCESS_TOKEN=sbp_... pnpm run email-otp:apply-template');
    }
  }

  console.log('');
  if (exitCode !== 0) {
    console.log('  Fix checklist:');
    console.log('    1. Vercel Production env → VITE_SUPABASE_URL=https://otiqckextvdbudbxzmau.supabase.co');
    console.log('    2. Vercel Production env → VITE_SUPABASE_ANON_KEY (from Supabase → Settings → API)');
    console.log('    3. Deploy latest main (includes public/supabase-config.json)');
    console.log('    4. Enable Google provider on the new Supabase project (pnpm run oauth:setup)');
    console.log('    5. Email OTP: Magic Link template + custom SMTP (pnpm run email-otp:setup)');
    console.log('    6. Re-run: pnpm run auth:check:prod');
  }
  console.log('');
  process.exit(exitCode);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
