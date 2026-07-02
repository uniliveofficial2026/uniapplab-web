#!/usr/bin/env node
/**
 * Apply Magic Link email template with {{ .Token }} for 6-digit OTP.
 * Requires SUPABASE_ACCESS_TOKEN (Dashboard → Account → Access Tokens).
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... pnpm run email-otp:apply-template
 */
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

async function main() {
  const env = readMergedEnv(import.meta.dirname);
  const ref = supabaseProjectRefFromEnv();
  const token = (process.env.SUPABASE_ACCESS_TOKEN || env.SUPABASE_ACCESS_TOKEN || '').trim();

  if (!ref) {
    console.error('Set VITE_SUPABASE_URL in .env first.');
    process.exit(1);
  }
  if (!token) {
    console.error('Missing SUPABASE_ACCESS_TOKEN.');
    console.error('Create one: https://supabase.com/dashboard/account/tokens');
    console.error('Then run: SUPABASE_ACCESS_TOKEN=sbp_... pnpm run email-otp:apply-template');
    process.exit(1);
  }

  const url = `https://api.supabase.com/v1/projects/${ref}/config/auth`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mailer_subjects_magic_link: OTP_SUBJECT,
      mailer_templates_magic_link_content: OTP_BODY,
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`Failed (${res.status}):`, text.slice(0, 400));
    process.exit(1);
  }

  console.log('');
  console.log('✓ Magic Link template updated for email OTP');
  console.log(`  Project: ${ref}`);
  console.log('  Template now includes {{ .Token }} (6-digit code)');
  console.log('');
  console.log('Next: configure custom SMTP for Gmail delivery:');
  console.log(`  https://supabase.com/dashboard/project/${ref}/settings/auth`);
  console.log('  Then run: pnpm run email-otp:setup');
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
