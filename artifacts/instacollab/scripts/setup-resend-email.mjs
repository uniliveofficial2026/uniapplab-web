#!/usr/bin/env node
/**
 * End-to-end Resend + Supabase email setup:
 * 1. Verify Resend API key with a test send
 * 2. Configure Supabase custom SMTP (Resend)
 * 3. Apply OTP email template with {{ .Token }}
 *
 * Requires in .env (workspace root or artifacts/instacollab):
 *   RESEND_API_KEY=re_...
 *   SUPABASE_ACCESS_TOKEN=sbp_...  (https://supabase.com/dashboard/account/tokens)
 *
 * Usage: pnpm run email:setup
 */
import { execSync } from 'node:child_process';
import { Resend } from 'resend';
import {
  readMergedEnv,
  supabaseProjectRefFromEnv,
} from './resolveProjectEnv.mjs';

const OTP_SUBJECT = 'Your UniAppLab sign-in code';
const OTP_BODY = `<h2>Your sign-in code</h2>
<p>Enter this 6-digit code in the app:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
<p>This code expires in 1 hour.</p>
<p>If you did not request this, you can ignore this email.</p>`;

const env = { ...readMergedEnv(), ...process.env };
const ref = supabaseProjectRefFromEnv();
const apiKey = (env.RESEND_API_KEY || '').trim();
const accessToken = (env.SUPABASE_ACCESS_TOKEN || '').trim();
const from = (env.RESEND_FROM || 'onboarding@resend.dev').trim();
const to = (env.RESEND_TO || 'uniliveofficial2026@gmail.com').trim();
const senderName = (env.RESEND_SENDER_NAME || 'UniAppLab').trim();

function fail(message) {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

function step(label) {
  console.log(`\n→ ${label}`);
}

async function patchSupabaseAuth(body) {
  const url = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Supabase API ${res.status}: ${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) : {};
}

async function main() {
  console.log('');
  console.log('UniAppLab — Resend + Supabase email setup');
  console.log('─────────────────────────────────────────');

  if (!ref) fail('Set VITE_SUPABASE_URL in .env first.');
  console.log(`  Project: ${ref}`);

  if (!apiKey || apiKey === 're_xxxxxxxxx') {
    fail(
      'Missing RESEND_API_KEY.\n' +
        '  1. https://resend.com/api-keys → Create API Key\n' +
        '  2. Add to .env: RESEND_API_KEY=re_your_key',
    );
  }

  step('Sending test email via Resend API');
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to,
    subject: 'UniAppLab — Resend test',
    html: '<p>Resend is working. Supabase OTP emails will use the same provider.</p>',
  });
  if (error) fail(`Resend test failed: ${JSON.stringify(error)}`);
  console.log(`  ✓ Test email sent to ${to} (id: ${data?.id ?? 'unknown'})`);

  if (!accessToken) {
    console.log('');
    console.log('⚠ Supabase SMTP not configured yet — need SUPABASE_ACCESS_TOKEN');
    console.log('  1. Open https://supabase.com/dashboard/account/tokens');
    console.log('  2. Create token → add to .env: SUPABASE_ACCESS_TOKEN=sbp_...');
    console.log('  3. Re-run: pnpm run email:setup');
    if (process.platform === 'darwin') {
      try {
        execSync('open "https://supabase.com/dashboard/account/tokens"', { stdio: 'ignore' });
      } catch {
        /* ignore */
      }
    }
    process.exit(0);
  }

  step('Configuring Supabase custom SMTP (Resend)');
  await patchSupabaseAuth({
    external_email_enabled: true,
    smtp_admin_email: from,
    smtp_sender_name: senderName,
    smtp_host: 'smtp.resend.com',
    smtp_port: '465',
    smtp_user: 'resend',
    smtp_pass: apiKey,
  });
  console.log(`  ✓ SMTP: smtp.resend.com:465, from ${from}`);

  step('Applying OTP email template (Magic Link → {{ .Token }})');
  await patchSupabaseAuth({
    mailer_subjects_magic_link: OTP_SUBJECT,
    mailer_templates_magic_link_content: OTP_BODY,
  });
  console.log('  ✓ Template updated for 6-digit codes');

  console.log('');
  console.log('✓ Email setup complete');
  console.log('');
  console.log('Test in app: Account switcher → Sign in with Email code → Send 6-digit code');
  console.log(`  Check ${to} (inbox, spam, promotions)`);
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
