#!/usr/bin/env node
/**
 * Send a test email via Resend.
 *
 * 1. Set RESEND_API_KEY in .env (replace re_xxxxxxxxx with your real key from resend.com)
 * 2. Run: pnpm run resend:test
 *
 * Optional .env overrides:
 *   RESEND_FROM=onboarding@resend.dev
 *   RESEND_TO=you@example.com
 */
import { Resend } from 'resend';
import { readMergedEnv } from './resolveProjectEnv.mjs';

const env = { ...readMergedEnv(import.meta.dirname), ...process.env };

const apiKey = (env.RESEND_API_KEY || '').trim();
if (!apiKey || apiKey === 're_xxxxxxxxx') {
  console.error('');
  console.error('Missing RESEND_API_KEY in .env');
  console.error('  1. Go to https://resend.com/api-keys');
  console.error('  2. Create an API key');
  console.error('  3. Add to .env: RESEND_API_KEY=re_your_real_key_here');
  console.error('');
  process.exit(1);
}

const from = (env.RESEND_FROM || 'onboarding@resend.dev').trim();
const to = (env.RESEND_TO || 'uniliveofficial2026@gmail.com').trim();

const resend = new Resend(apiKey);

const { data, error } = await resend.emails.send({
  from,
  to,
  subject: 'Hello World',
  html: '<p>Congrats on sending your <strong>first email</strong>!</p>',
});

if (error) {
  console.error('Failed to send email:', error);
  process.exit(1);
}

console.log('');
console.log('✓ Email sent');
console.log(`  From: ${from}`);
console.log(`  To:   ${to}`);
console.log(`  Id:   ${data?.id ?? '(unknown)'}`);
console.log('');
