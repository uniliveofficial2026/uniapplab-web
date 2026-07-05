import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { securityHeaders } from "./middlewares/securityHeaders";
import { fallbackRateLimit } from "./middlewares/fallbackRateLimit";
import { isUpstashConfigured } from "./lib/upstash";

function parseCorsOrigins(): string[] | boolean {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
    if (!raw || raw === "*") {
      return [
        "https://app.uniapplab.com",
        "https://uniapplab.com",
        "https://www.uniapplab.com",
      ];
    }
    return raw.split(",").map((o) => o.trim()).filter(Boolean);
  }
  if (!raw || raw === "*") return true;
  return raw.split(",").map((o) => o.trim()).filter(Boolean);
}

const app: Express = express();

app.use(securityHeaders);
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: parseCorsOrigins(), credentials: true }));
if (!isUpstashConfigured()) {
  app.use(fallbackRateLimit);
}
app.use("/api/qstash", express.raw({ type: "application/json" }));
app.use("/api/livekit/webhook", express.raw({ type: "application/webhook+json" }));
app.use("/api/linear/webhook", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    logger.error({ err }, "Unhandled API error");
    res.status(500).json({ error: "Internal server error" });
  },
);

export default app;
