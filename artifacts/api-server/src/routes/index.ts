import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import hsnRouter from "./hsn";
import lookupsRouter from "./lookups";
import materialsRouter from "./materials";
import fabricsRouter from "./fabrics";
import ordersRouter from "./orders";
import clientsRouter from "./clients";
import vendorsRouter from "./vendors";
import styleCategoriesRouter from "./styleCategories";
import swatchCategoriesRouter from "./swatchCategories";
import swatchesRouter from "./swatches";
import stylesRouter from "./styles";
import packagingMaterialsRouter from "./packagingMaterials";
import userManagementRouter from "./userManagement";
import swatchOrdersRouter from "./swatchOrders";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(userManagementRouter);
router.use(hsnRouter);
router.use(lookupsRouter);
router.use(materialsRouter);
router.use(fabricsRouter);
router.use(ordersRouter);
router.use(clientsRouter);
router.use(vendorsRouter);
router.use(styleCategoriesRouter);
router.use(swatchCategoriesRouter);
router.use(swatchesRouter);
router.use(stylesRouter);
router.use(packagingMaterialsRouter);
router.use(swatchOrdersRouter);

export default router;
