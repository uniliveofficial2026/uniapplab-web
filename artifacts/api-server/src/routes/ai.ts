import { Router, type IRouter } from "express";
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { auth } from "../middlewares/auth";
import { requireNotBanned } from "../middlewares/requireNotBanned";

const router: IRouter = Router();

function geminiModel() {
  const apiKey = String(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "").trim();
  if (!apiKey) return null;
  const google = createGoogleGenerativeAI({ apiKey });
  return google("gemini-2.0-flash");
}

router.get("/ai/health", (_req, res) => {
  res.json({
    status: "ok",
    provider: "ai-sdk",
    geminiConfigured: Boolean(geminiModel()),
  });
});

router.post("/ai/generate", auth, requireNotBanned, async (req, res, next) => {
  try {
    const model = geminiModel();
    if (!model) {
      res.status(503).json({ error: "GEMINI_API_KEY is not configured on the server." });
      return;
    }

    const prompt = String((req.body as { prompt?: string })?.prompt ?? "").trim();
    if (!prompt) {
      res.status(400).json({ error: "prompt is required" });
      return;
    }

    const maxOutputTokens = Math.min(
      4096,
      Math.max(64, Number((req.body as { maxOutputTokens?: number })?.maxOutputTokens) || 1024),
    );

    const result = await generateText({
      model,
      prompt,
      maxOutputTokens,
    });

    res.json({
      text: result.text,
      usage: result.usage,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
