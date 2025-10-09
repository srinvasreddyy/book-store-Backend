import { Router } from "express";
import {
    createDiscount,
    getAllDiscounts,
    getDiscountByCode,
    updateDiscount,
    deleteDiscount
} from "../controllers/discount.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyAdmin } from "../middlewares/rbac.middleware.js";

const router = Router();

// Public route for coupon validation
router.route("/code/:couponCode").get(getDiscountByCode);

// Admin routes
router.route("/all").get(verifyJWT, verifyAdmin, getAllDiscounts);
router.route("/").post(verifyJWT, verifyAdmin, createDiscount);
router.route("/:discountId").patch(verifyJWT, verifyAdmin, updateDiscount);
router.route("/:discountId").delete(verifyJWT, verifyAdmin, deleteDiscount);

export default router;