#!/usr/bin/env node
/**
 * Verify uniapplab.com ownership for Google OAuth homepage requirements.
 *
 * Google rejects consent screens when the Application home page domain is not
 * verified in Search Console by a GCP project Owner/Editor.
 *
 * Usage:
 *   # Print steps only
 *   node scripts/verify-google-domain.mjs
 *
 *   # Add Search Console DNS TXT via Cloudflare (after you copy the token)
 *   node scripts/verify-google-domain.mjs --token=XXXXXXXX
 *   # or paste full record content:
 *   node scripts/verify-google-domain.mjs --txt='google-site-verification=XXXXXXXX'
 *
 * Then click Verify in Google Search Console.
 */
import { spawnSync } from 'node:child_process';

const ZONE_ID = 'd6a3f463bf0d8b04f25eb51ba32537fc';
const DOMAIN = 'uniapplab.com';
const HOMEPAGE = 'https://app.uniapplab.com/home/';
const PRIVACY = 'https://app.uniapplab.com/privacy-policy.html';
const TERMS = 'https://app.uniapplab.com/terms-of-service.html';
const CONSENT = 'https://console.cloud.google.com/apis/credentials/consent';
const SEARCH_CONSOLE = 'https://search.google.com/search-console?resource_id=sc-domain%3Auniapplab.com';
const SEARCH_CONSOLE_ADD = 'https://search.google.com/search-console/welcome';

function argValue(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function printSteps() {
  console.log('');
  console.log('UniLive — Google homepage ownership (Search Console)');
  console.log('──────────────────────────────────────────────────');
  console.log('');
  console.log('Google error: “Your home page website is not registered to you.”');
  console.log('Fix: verify TOP private domain uniapplab.com in Search Console');
  console.log('with the SAME Google account that owns the GCP OAuth project');
  console.log('(uniliveofficial2026@gmail.com).');
  console.log('');
  console.log('1) OAuth consent screen URLs (must match these exactly):');
  console.log(`   Application home page: ${HOMEPAGE}`);
  console.log(`   Privacy policy:        ${PRIVACY}`);
  console.log(`   Terms of service:      ${TERMS}`);
  console.log('   Authorized domains:    uniapplab.com');
  console.log(`   ${CONSENT}`);
  console.log('');
  console.log('2) Google Search Console → Add property → Domain → uniapplab.com');
  console.log(`   ${SEARCH_CONSOLE_ADD}`);
  console.log('   Choose DNS record verification. Copy the TXT token.');
  console.log('');
  console.log('3) Add the TXT record on Cloudflare DNS:');
  console.log('   node artifacts/instacollab/scripts/verify-google-domain.mjs --token=PASTE_TOKEN');
  console.log('');
  console.log('4) Click Verify in Search Console, then reply to Google’s review email');
  console.log('   that ownership of uniapplab.com is verified.');
  console.log('');
  console.log('5) Homepage content (already shipped, no login required):');
  console.log(`   ${HOMEPAGE}`);
  console.log('');
}

async function addTxtViaCurl(content) {
  const token = process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN;
  if (!token) {
    console.error('Set CLOUDFLARE_API_TOKEN (or CF_API_TOKEN) to write DNS, or add the TXT in Cloudflare Dashboard:');
    console.error(`  Type: TXT   Name: ${DOMAIN}   Content: ${content}`);
    process.exit(1);
  }

  const list = spawnSync(
    'curl',
    [
      '-sS',
      '-H',
      `Authorization: Bearer ${token}`,
      '-H',
      'Content-Type: application/json',
      `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?type=TXT&per_page=100`,
    ],
    { encoding: 'utf8' },
  );
  if (list.status !== 0) {
    console.error(list.stderr || list.stdout);
    process.exit(1);
  }
  const listed = JSON.parse(list.stdout);
  const existing = (listed.result || []).find(
    (r) => String(r.content || '').replace(/^"|"$/g, '') === content.replace(/^"|"$/g, ''),
  );
  if (existing) {
    console.log('TXT already present:', existing.id);
    return;
  }

  const body = JSON.stringify({
    type: 'TXT',
    name: DOMAIN,
    content,
    ttl: 3600,
  });
  const created = spawnSync(
    'curl',
    [
      '-sS',
      '-X',
      'POST',
      '-H',
      `Authorization: Bearer ${token}`,
      '-H',
      'Content-Type: application/json',
      '--data',
      body,
      `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records`,
    ],
    { encoding: 'utf8' },
  );
  const parsed = JSON.parse(created.stdout || '{}');
  if (!parsed.success) {
    console.error('Cloudflare DNS create failed:', JSON.stringify(parsed.errors || parsed, null, 2));
    process.exit(1);
  }
  console.log('Added TXT record on', DOMAIN);
  console.log('Content:', content);
  console.log('Now click Verify in Search Console:');
  console.log(`  ${SEARCH_CONSOLE}`);
}

printSteps();

const token = argValue('token');
const txtArg = argValue('txt');
if (!token && !txtArg) {
  if (process.platform === 'darwin') {
    try {
      spawnSync('open', [SEARCH_CONSOLE_ADD], { stdio: 'ignore' });
      spawnSync('open', [CONSENT], { stdio: 'ignore' });
    } catch {
      /* ignore */
    }
  }
  process.exit(0);
}

const content = txtArg
  ? txtArg.replace(/^["']|["']$/g, '')
  : `google-site-verification=${token}`;

await addTxtViaCurl(content);
