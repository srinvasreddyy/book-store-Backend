import { Router } from "express";
import {
    createCategory,
    getAllCategories,
    getCategoryById,
    updateCategory,
    deleteCategory,
    toggleCategoryPin
} from "../controllers/category.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyAdmin } from "../middlewares/rbac.middleware.js"; // FIXED: Imported from rbac.middleware.js
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// Public route for fetching categories
router.route("/")
    .get(getAllCategories)
    .post(verifyJWT, verifyAdmin, upload.single("backgroundImage"), createCategory);

router.route("/:categoryId")
    .get(getCategoryById)
    .put(verifyJWT, verifyAdmin, upload.single("backgroundImage"), updateCategory)
    .delete(verifyJWT, verifyAdmin, deleteCategory);

// Pinning Route
router.route("/:categoryId/pin")
    .patch(verifyJWT, verifyAdmin, toggleCategoryPin);

export default router;