import { Router } from "express";
import {
    createCategory,
    getAllCategories,
    getCategoryList,
    getCategoryById,
    updateCategory,
    deleteCategory
} from "../controllers/category.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyAdmin } from "../middlewares/rbac.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// --- Consolidated Route Definitions ---

// 1. Root Collection Routes
router.route("/")
    .get(getAllCategories) // Public: Get Tree
    .post(
        verifyJWT, 
        verifyAdmin, 
        upload.single("backgroundImage"), 
        createCategory
    ); // Admin: Create

// 2. List Route (Dropdowns)
router.route("/list")
    .get(getCategoryList);

// 3. Single Item Routes (Consolidated to prevent 404s)
router.route("/:categoryId")
    .get(getCategoryById) // Public: Get One
    .patch(
        verifyJWT, 
        verifyAdmin, 
        upload.single("backgroundImage"), 
        updateCategory
    ) // Admin: Update (and Pin)
    .delete(
        verifyJWT, 
        verifyAdmin, 
        deleteCategory
    ); // Admin: Delete

export default router;