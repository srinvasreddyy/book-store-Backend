import { Router } from "express";
import { getDashboardStats, getAdminBookStats, getAdminSalesStats, getRecentOrders } from "../controllers/dashboard.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyAdmin } from "../middlewares/rbac.middleware.js";

const router = Router();

// Apply admin verification to all routes in this file
router.use(verifyJWT, verifyAdmin);

router.route("/stats").get(getDashboardStats);
router.route("/admin/book-stats").get(getAdminBookStats);
router.route("/admin/sales-stats").get(getAdminSalesStats);
router.route("/recent-orders").get(getRecentOrders);

export default router;