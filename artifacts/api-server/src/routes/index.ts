import { Router, type IRouter } from "express";
import healthRouter from "./health";
import meRouter from "./me";
import adminRouter from "./admin";
import walletRouter from "./wallet";
import chatRouter from "./chat";
import streamRouter from "./stream";
import presenceRouter from "./presence";
import livekitRouter from "./livekit";
import uxRouter from "./ux";
import handoffRouter from "./handoff";
import feedRouter from "./feed";
import upstashRouter from "./upstash";
import qstashRouter from "./qstash";
import { upstashRateLimit } from "../lib/ratelimit";

const router: IRouter = Router();

router.use(healthRouter);
router.use(upstashRouter);
router.use(livekitRouter);
router.use(qstashRouter);
router.use(upstashRateLimit);
router.use(feedRouter);
router.use("/me", meRouter);
router.use("/admin", adminRouter);
router.use("/wallet", walletRouter);
router.use("/chat", chatRouter);
router.use("/stream", streamRouter);
router.use(presenceRouter);
router.use(uxRouter);
router.use(handoffRouter);

export default router;
