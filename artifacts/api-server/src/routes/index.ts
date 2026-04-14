import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import hsnRouter from "./hsn";
import lookupsRouter from "./lookups";
import materialsRouter from "./materials";
import fabricsRouter from "./fabrics";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(hsnRouter);
router.use(lookupsRouter);
router.use(materialsRouter);
router.use(fabricsRouter);

export default router;
