#!/usr/bin/env node
/**
 * Local dev: Vite on :5173 plus http://localhost:3000 proxy (OAuth / legacy URLs).
 */
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const vitePort = Number(process.env.VITE_DEV_PORT ?? process.env.PORT ?? '5173');
const proxyPort = Number(process.env.DEV_PROXY_PORT ?? '3000');

if (!Number.isFinite(vitePort) || vitePort <= 0) {
  console.error(`[dev] Invalid Vite port: ${process.env.VITE_DEV_PORT ?? process.env.PORT}`);
  process.exit(1);
}

if (!Number.isFinite(proxyPort) || proxyPort <= 0) {
  console.error(`[dev] Invalid proxy port: ${process.env.DEV_PROXY_PORT}`);
  process.exit(1);
}

const targetHost = '127.0.0.1';
const targetOrigin = `http://${targetHost}:${vitePort}`;

function freePort(port) {
  spawnSync('node', ['scripts/free-port.mjs', String(port)], {
    cwd: appRoot,
    stdio: 'inherit',
  });
}

function startProxy() {
  const server = http.createServer((clientReq, clientRes) => {
    const url = new URL(clientReq.url || '/', targetOrigin);
    const proxyReq = http.request(
      {
        hostname: targetHost,
        port: vitePort,
        path: url.pathname + url.search,
        method: clientReq.method,
        headers: {
          ...clientReq.headers,
          host: `${targetHost}:${vitePort}`,
        },
      },
      (proxyRes) => {
        clientRes.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
        proxyRes.pipe(clientRes);
      },
    );

    proxyReq.on('error', (error) => {
      if (!clientRes.headersSent) {
        clientRes.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
      }
      clientRes.end(`Vite is not ready on ${targetOrigin}: ${error.message}`);
    });

    clientReq.pipe(proxyReq);
  });

  server.on('upgrade', (req, socket, head) => {
    const proxySocket = net.connect(vitePort, targetHost, () => {
      let header = `${req.method} ${req.url} HTTP/1.1\r\n`;
      for (const [key, value] of Object.entries(req.headers)) {
        if (value === undefined) continue;
        header += `${key}: ${Array.isArray(value) ? value.join(', ') : value}\r\n`;
      }
      header = header.replace(/host:.*\r\n/i, `host: ${targetHost}:${vitePort}\r\n`);
      if (!/host:/i.test(header)) {
        header += `host: ${targetHost}:${vitePort}\r\n`;
      }
      header += '\r\n';
      proxySocket.write(header);
      if (head?.length) proxySocket.write(head);
      proxySocket.pipe(socket);
      socket.pipe(proxySocket);
    });

    proxySocket.on('error', () => socket.destroy());
    socket.on('error', () => proxySocket.destroy());
  });

  server.listen(proxyPort, '127.0.0.1', () => {
    console.log(`[dev] Proxy  http://localhost:${proxyPort} → ${targetOrigin}`);
  });

  return server;
}

freePort(vitePort);
if (proxyPort !== vitePort) {
  freePort(proxyPort);
}

console.log('[dev] Starting Vite…');
console.log(`[dev] App     http://localhost:${vitePort}`);
console.log(`[dev] Alias   http://localhost:${proxyPort}`);

const vite = spawn(
  process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
  ['exec', 'vite', '--config', 'vite.config.ts', '--port', String(vitePort), '--strictPort'],
  {
    cwd: appRoot,
    stdio: 'inherit',
    env: { ...process.env, PORT: String(vitePort) },
  },
);

const proxyServer = proxyPort === vitePort ? null : startProxy();

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (signal) console.log(`\n[dev] ${signal} — stopping…`);
  proxyServer?.close();
  vite.kill('SIGTERM');
  setTimeout(() => vite.kill('SIGKILL'), 1500).unref();
}

vite.on('exit', (code) => {
  proxyServer?.close();
  process.exit(code ?? 0);
});

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
