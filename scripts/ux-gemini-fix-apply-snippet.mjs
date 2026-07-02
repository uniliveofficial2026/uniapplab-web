function applyFix(fix) {
  const rel = fix.file?.replace(/^\//, '');
  if (!rel || !SAFE_FIX_FILES.has(rel)) return false;
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return false;

  const search = fix.search ?? '';
  const replace = fix.replace ?? '';
  if (!search || search.length < 8) return false;
  if (search.length > 800 || replace.length > 1200) return false;
  if (/\b(API_KEY|SECRET|PASSWORD|TOKEN)\b/i.test(replace)) return false;
  if (/package\.json|pnpm-lock|\.env/i.test(rel)) return false;

  const content = fs.readFileSync(abs, 'utf8');
  const occurrences = content.split(search).length - 1;
  if (occurrences !== 1) return false;

  const next = content.replace(search, replace);
  if (next === content) return false;

  const backup = `${content}`;
  fs.writeFileSync(abs, next);

  const healthScript = path.join(ROOT, 'artifacts/instacollab/scripts/check-health.mjs');
  const healthOk = spawnSync('node', [healthScript], { cwd: ROOT, stdio: 'ignore' }).status === 0;
  if (!healthOk) {
    fs.writeFileSync(abs, backup);
    return false;
  }

  fs.appendFileSync(FIX_LOG, `${JSON.stringify({ t: Date.now(), file: rel, reason: fix.reason, verified: true })}\n`);
  return true;
}
