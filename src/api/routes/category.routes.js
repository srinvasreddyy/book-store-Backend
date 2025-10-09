import { Router } from "express";
import {
    createCategory,
    getAllCategories,
    updateCategory,
    deleteCategory,
} from "../controllers/category.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyAdmin } from "../middlewares/rbac.middleware.js";

const router = Router();

// Public route
router.route("/").get(getAllCategories);

// Admin routes
router.route("/").post(verifyJWT, verifyAdmin, createCategory);
router.route("/:categoryId").patch(verifyJWT, verifyAdmin, updateCategory);
router.route("/:categoryId").delete(verifyJWT, verifyAdmin, deleteCategory);

export default router;