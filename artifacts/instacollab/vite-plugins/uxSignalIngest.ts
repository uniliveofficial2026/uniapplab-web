import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

/** Dev-only ingest for UX signals → .local/ux-signals.jsonl (background ML agent). */
export function uxSignalIngestPlugin(workspaceRoot: string): Plugin {
  const logPath = path.join(workspaceRoot, ".local/ux-signals.jsonl");

  return {
    name: "ux-signal-ingest",
    configureServer(server) {
      server.middlewares.use("/__ux/signal", (req, res, next) => {
        if (req.method !== "POST") {
          next();
          return;
        }

        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
        });
        req.on("end", () => {
          try {
            const parsed = JSON.parse(body) as { signals?: unknown[] };
            const signals = Array.isArray(parsed.signals) ? parsed.signals : [];
            if (signals.length) {
              fs.mkdirSync(path.dirname(logPath), { recursive: true });
              for (const signal of signals) {
                fs.appendFileSync(logPath, `${JSON.stringify(signal)}\n`);
              }
            }
            res.statusCode = 204;
            res.end();
          } catch {
            res.statusCode = 400;
            res.end();
          }
        });
      });
    },
  };
}
