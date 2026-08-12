import pino from "pino";

/** Never enable pino-pretty on Vercel — NODE_ENV may be "sandbox" in vercel.json. */
const usePretty =
  process.env.VERCEL !== "1" &&
  process.env.NODE_ENV !== "production" &&
  process.env.LOG_PRETTY === "1";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  ...(usePretty
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }
    : {}),
});
