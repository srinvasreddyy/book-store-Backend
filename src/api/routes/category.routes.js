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

// Public routes
router.route("/").get(getAllCategories); // Returns tree structure
router.route("/list").get(getCategoryList); // Returns flat list (for internal use/dropdowns)
router.route("/:categoryId").get(getCategoryById);

// Admin routes
router.use(verifyJWT, verifyAdmin);

router.route("/")
    .post(upload.single("backgroundImage"), createCategory);

router.route("/:categoryId")
    .patch(upload.single("backgroundImage"), updateCategory)
    .delete(deleteCategory);

export default router;