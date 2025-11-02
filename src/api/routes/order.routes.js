import { Router } from "express";
import {
  initiateOrder,
  getUserOrders,
  getAllOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  getOrderStats,
  cleanupAbandonedOrders
} from "../controllers/order.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyAdmin } from "../middlewares/rbac.middleware.js";

const router = Router();

// User routes
router.use(verifyJWT);
// Get orders for the currently authenticated user
router.route("/").get(getUserOrders);
router.route("/initiate").post(initiateOrder);

// Admin routes
router.use(verifyAdmin);
router.route("/admin/stats").get(getOrderStats);
router.route("/admin/cleanup").post(cleanupAbandonedOrders);
router.route("/admin").get(getAllOrders);
router.route("/admin/:orderId").get(getOrderById);
router.route("/admin/:orderId").patch(updateOrder);
router.route("/admin/:orderId").delete(deleteOrder);

export default router;
