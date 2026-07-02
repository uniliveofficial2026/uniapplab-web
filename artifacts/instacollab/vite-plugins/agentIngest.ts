import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

/** Dev ingest: UX signals + handoff tasks → .local/ (background ML agent). */
export function agentIngestPlugin(workspaceRoot: string): Plugin {
  const signalsPath = path.join(workspaceRoot, ".local/ux-signals.jsonl");
  const handoffPath = path.join(workspaceRoot, ".local/handoff-queue.jsonl");

  function readBody(req: import("http").IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => resolve(body));
      req.on("error", reject);
    });
  }

  return {
    name: "agent-ingest",
    configureServer(server) {
      server.middlewares.use("/__ux/signal", async (req, res, next) => {
        if (req.method !== "POST") {
          next();
          return;
        }
        try {
          const parsed = JSON.parse(await readBody(req)) as { signals?: unknown[] };
          const signals = Array.isArray(parsed.signals) ? parsed.signals : [];
          if (signals.length) {
            fs.mkdirSync(path.dirname(signalsPath), { recursive: true });
            for (const signal of signals) {
              fs.appendFileSync(signalsPath, `${JSON.stringify(signal)}\n`);
            }
          }
          res.statusCode = 204;
          res.end();
        } catch {
          res.statusCode = 400;
          res.end();
        }
      });

      server.middlewares.use("/__handoff/task", async (req, res, next) => {
        if (req.method !== "POST") {
          next();
          return;
        }
        try {
          const task = JSON.parse(await readBody(req)) as Record<string, unknown>;
          const entry = {
            id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            t: Date.now(),
            status: "pending",
            priority: 3,
            source: "client",
            ...task,
          };
          fs.mkdirSync(path.dirname(handoffPath), { recursive: true });
          fs.appendFileSync(handoffPath, `${JSON.stringify(entry)}\n`);
          res.statusCode = 204;
          res.end();
        } catch {
          res.statusCode = 400;
          res.end();
        }
      });
    },
  };
}
