#!/usr/bin/env node
import { createUniLiveCli, PLATFORM_VERSION } from './index.mjs';

const argv = process.argv.slice(2);
const jsonFlag = argv.includes('--json');
const args = argv.filter((a) => a !== '--json');

function parseFlags(rest) {
  /** @type {Record<string, string | boolean>} */
  const flags = {};
  const positional = [];
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = rest[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i += 1;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

const [cmd, ...rest] = args;
const { flags, positional } = parseFlags(rest);
const cli = createUniLiveCli({ cwd: process.cwd() });

const map = {
  version: () => cli.version(),
  login: () => cli.login(),
  logout: () => cli.logout(),
  whoami: () => cli.whoami(),
  init: () => cli.init({ name: positional[0] || 'unilive-app' }),
  create: () =>
    cli.create({
      name: positional[0] || 'my-app',
      template: String(flags.template || 'basic'),
      outDir: flags.out ? String(flags.out) : undefined,
    }),
  doctor: () => cli.doctor(),
  'rtc-status': () => cli.rtcStatus(),
  rtc: () => {
    if (positional[0] === 'status') return cli.rtcStatus();
    return { ok: false, error: 'usage: unilive rtc status' };
  },
  'db-status': () => cli.dbStatus(),
  'db-migrate': () => cli.dbMigrate(),
  db: () => {
    if (positional[0] === 'status') return cli.dbStatus();
    if (positional[0] === 'migrate') return cli.dbMigrate();
    return { ok: false, error: 'usage: unilive db status|migrate' };
  },
  build: () => cli.build(),
  test: () => cli.test(),
  deploy: () => cli.deploy(),
  logs: () => cli.logs(),
  start: () => cli.start({ local: true }),
  dev: () => cli.dev(),
  studio: () => cli.studio({ port: Number(flags.port) || 8787 }),
  project: () => {
    if (positional[0] === 'list') return cli.projectList();
    if (positional[0] === 'use') return cli.projectUse({ projectId: positional[1] });
    return { ok: false, error: 'usage: unilive project list|use <id>' };
  },
  'mcp-list': () => cli.mcpList(),
  help: () => ({
    ok: true,
    version: PLATFORM_VERSION,
    usage: 'unilive <command> [--json]',
    commands: [
      'version',
      'login',
      'logout',
      'whoami',
      'init',
      'create [--template <id>]',
      'doctor',
      'build',
      'test',
      'db status',
      'db migrate',
      'rtc status',
      'logs',
      'deploy',
      'project list',
      'project use <id>',
      'start',
      'dev',
      'studio [--port N]',
      'mcp-list',
    ],
  }),
};

if (!cmd || cmd === '--help' || cmd === '-h') {
  const help = await map.help();
  console.log(JSON.stringify(help, null, 2));
  process.exit(0);
}

if (cmd === '--version' || cmd === '-V') {
  console.log(JSON.stringify(await cli.version(), null, 2));
  process.exit(0);
}

const handler = map[cmd];
if (!handler) {
  console.log(
    JSON.stringify(
      { ok: false, error: 'unknown_command', command: cmd, hint: 'unilive help' },
      null,
      2,
    ),
  );
  process.exit(1);
}

const result = await handler();
// Studio keeps process alive unless --json smoke (caller closes)
if (cmd === 'studio' && result?.close && !jsonFlag) {
  console.log(JSON.stringify({ ok: true, url: result.url, port: result.port }, null, 2));
  process.on('SIGINT', async () => {
    await result.close();
    process.exit(0);
  });
} else {
  if (result?.close) await result.close();
  const { close: _c, ...safe } = result || {};
  console.log(JSON.stringify(safe, null, 2));
  process.exit(result?.ok === false ? 1 : 0);
}
