import { Router } from "express";
import {
  createDiscount,
  getMyDiscounts,
  validateDiscount,
  updateDiscount,
  deleteDiscount,
  getAvailableDiscounts,
} from "../controllers/discount.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyAdmin } from "../middlewares/rbac.middleware.js";

const router = Router();

// Public routes (no authentication required)
router.route("/available").get(getAvailableDiscounts);
router.route("/validate").post(validateDiscount);

// Admin routes
router.use(verifyJWT, verifyAdmin);

router.route("/").post(createDiscount);
router.route("/my-discounts").get(getMyDiscounts);
router.route("/:discountId").patch(updateDiscount);
router.route("/:discountId").delete(deleteDiscount);

export default router;
