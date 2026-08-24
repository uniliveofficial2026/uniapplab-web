#!/usr/bin/env node
import { createUniLiveCli } from './index.mjs';

const cli = createUniLiveCli({ cwd: process.cwd() });
const [,, cmd, ...rest] = process.argv;

const map = {
  login: () => cli.login(),
  init: () => cli.init({ name: rest[0] || 'unilive-app' }),
  doctor: () => cli.doctor(),
  'rtc-status': () => cli.rtcStatus(),
  'db-status': () => cli.dbStatus(),
  'db-migrate': () => cli.dbMigrate(),
  build: () => cli.build(),
  test: () => cli.test(),
  deploy: () => cli.deploy(),
  logs: () => cli.logs(),
  dev: () => cli.dev(),
  'mcp-list': () => cli.mcpList(),
};

if (!cmd || cmd === 'help' || !map[cmd]) {
  console.log(JSON.stringify({
    commands: Object.keys(map),
    usage: 'unilive <command>',
  }, null, 2));
  process.exit(cmd && cmd !== 'help' && !map[cmd] ? 1 : 0);
}

const result = await map[cmd]();
console.log(JSON.stringify(result, null, 2));
process.exit(result?.ok === false ? 1 : 0);
