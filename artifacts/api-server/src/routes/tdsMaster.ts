import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import * as controller from "../controllers/tdsMasterController";

const router: IRouter = Router();

router.post(
  "/tds-master",
  requireAuth,
  controller.createTdsMaster,
);

router.get(
  "/tds-master",
  requireAuth,
  controller.getTdsMasters,
);

router.get(
  "/tds-master/export",
  requireAuth,
  controller.exportTDSRecords,
);

router.post(
  "/tds-master/import",
  requireAuth,
  controller.importTDSRecords
);

router.get(
  "/tds-master/:id",
  requireAuth,
  controller.getTdsMasterById,
);

router.put(
  "/tds-master/:id",
  requireAuth,
  controller.updateTdsMaster,
);

router.patch(
  "/tds-master/:id",
  requireAuth,
  controller.updateTdsMasterStatus,
);

router.delete(
  "/tds-master/:id",
  requireAuth,
  controller.deleteTdsMaster,
);

export default router;