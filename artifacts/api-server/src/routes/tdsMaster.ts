import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import * as controller from "../controllers/tdsMasterController";
import { MASTERS_TDS } from "../constants/permissions";
import { checkPermission } from "../middlewares/checkPermission";

const router: IRouter = Router();

router.post(
  "/tds-master",
  requireAuth,
  checkPermission(MASTERS_TDS.ADD_EDIT),
  controller.createTdsMaster,
);

router.get(
  "/tds-master",
  requireAuth,
  checkPermission(MASTERS_TDS.VIEW),
  controller.getTdsMasters,
);

router.get(
  "/tds-master/export",
  requireAuth,
  checkPermission(MASTERS_TDS.DOWNLOAD),
  controller.exportTDSRecords,
);

router.post(
  "/tds-master/import",
  requireAuth,
  checkPermission(MASTERS_TDS.ADD_EDIT),
  controller.importTDSRecords
);

router.get(
  "/tds-master/:id",
  requireAuth,
  checkPermission(MASTERS_TDS.VIEW),
  controller.getTdsMasterById,
);

router.put(
  "/tds-master/:id",
  requireAuth,
  checkPermission(MASTERS_TDS.ADD_EDIT),
  controller.updateTdsMaster,
);

router.patch(
  "/tds-master/:id",
  requireAuth,
  checkPermission(MASTERS_TDS.ADD_EDIT),
  controller.updateTdsMasterStatus,
);

router.delete(
  "/tds-master/:id",
  requireAuth,
  checkPermission(MASTERS_TDS.DELETE),
  controller.deleteTdsMaster,
);

export default router;