#!/usr/bin/env node
/**
 * Print Supabase Email OTP + SMTP setup (required for Gmail delivery).
 * Usage: pnpm run email-otp:setup
 */
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import {
  findEnvFile,
  getAppRoot,
  supabaseProjectRefFromEnv,
} from './resolveProjectEnv.mjs';

const envPath = findEnvFile(import.meta.dirname);
const ref = supabaseProjectRefFromEnv(envPath) || 'YOUR_PROJECT_REF';
const templatesUrl = `https://supabase.com/dashboard/project/${ref}/auth/templates`;
const smtpUrl = `https://supabase.com/dashboard/project/${ref}/settings/auth`;
const providersUrl = `https://supabase.com/dashboard/project/${ref}/auth/providers`;

console.log('');
console.log('UniAppLab — Email OTP setup (6-digit codes to Gmail, etc.)');
console.log('──────────────────────────────────────────────────────────');
console.log('');
console.log(`  Project: ${ref}`);
console.log(`  .env: ${fs.existsSync(envPath) ? envPath : '(not found)'}`);
console.log('');
console.log('  WHY codes do not arrive');
console.log('  • Default Supabase mail is rate-limited and often blocked by Gmail.');
console.log('  • Template must send {{ .Token }} (OTP), not only a magic link URL.');
console.log('');
console.log('  1. Email template → Magic Link');
console.log(`     ${templatesUrl}`);
console.log('     Subject: Your UniAppLab sign-in code');
console.log('     Body (minimal example):');
console.log('');
console.log('       <h2>Your sign-in code</h2>');
console.log('       <p>Enter this 6-digit code in the app:</p>');
console.log('       <p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>');
console.log('       <p>This code expires in 1 hour.</p>');
console.log('');
console.log('     Important: include {{ .Token }}. Remove {{ .ConfirmationURL }} if you only want OTP.');
console.log('');
console.log('  2. Enable Email provider');
console.log(`     ${providersUrl}`);
console.log('     • Email → Enabled');
console.log('     • Confirm email: optional (OTP verify already proves inbox ownership)');
console.log('');
console.log('  3. Custom SMTP (strongly recommended for Gmail)');
console.log(`     ${smtpUrl}`);
console.log('     • Enable custom SMTP');
console.log('     • Use Resend, SendGrid, Brevo, or Amazon SES');
console.log('     • From address: noreply@your-verified-domain.com');
console.log('');
console.log('  4. Apply OTP template automatically (optional)');
console.log('     Create token: https://supabase.com/dashboard/account/tokens');
console.log('     SUPABASE_ACCESS_TOKEN=sbp_... pnpm run email-otp:apply-template');
console.log('');
console.log('  5. Resend SMTP example (recommended for Gmail)');
console.log('     • resend.com → API Keys → create key');
console.log('     • Verify domain uniapplab.com (or use onboarding@resend.dev for testing only)');
console.log('     • Supabase SMTP: smtp.resend.com, port 465, user resend, password = API key');
console.log('     • From: noreply@your-verified-domain.com');
console.log('');
console.log('  6. Test in app');
console.log('     • Account switcher → Sign in with Email code → Send 6-digit code');
console.log('     • Check Gmail → Spam → Promotions');
console.log('     • Wait 60s between resend attempts');
console.log('');

if (process.platform === 'darwin') {
  try {
    execSync(`open "${templatesUrl}"`, { stdio: 'ignore' });
  } catch {
    /* ignore */
  }
}
