import { Router, type IRouter } from "express";
import { buildPublicBootstrapFromEnv, ensureBaseline } from "../config";
import { redactErrorMessage } from "../config/redaction";

const router: IRouter = Router();

router.get("/bootstrap", (_req, res) => {
  try {
    ensureBaseline();
    const body = buildPublicBootstrapFromEnv();
    res.json(body);
  } catch (err) {
    res.status(500).json({ error: redactErrorMessage(err instanceof Error ? err.message : "bootstrap failed") });
  }
});

export default router;
