import { Router, type IRouter } from "express";
import healthRouter from "./health";
import meRouter from "./me";
import adminRouter from "./admin";
import walletRouter from "./wallet";
import chatRouter from "./chat";
import streamRouter from "./stream";
import uxRouter from "./ux";
import handoffRouter from "./handoff";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/me", meRouter);
router.use("/admin", adminRouter);
router.use("/wallet", walletRouter);
router.use("/chat", chatRouter);
router.use("/stream", streamRouter);
router.use(uxRouter);
router.use(handoffRouter);

export default router;
