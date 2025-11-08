import { Router } from "express";
import {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from "../controllers/category.controller.js";
import {
  createSubCategory,
  getAllSubCategories,
  updateSubCategory,
  deleteSubCategory,
} from "../controllers/subCategory.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyAdmin } from "../middlewares/rbac.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// --- Public Routes ---
router.route("/").get(getAllCategories);
router.route("/subs").get(getAllSubCategories); // List all subcategories
router.route("/:categoryId").get(getCategoryById);

// --- Admin Routes ---
router.use(verifyJWT, verifyAdmin);

// Category management
router.route("/").post(upload.single("backgroundImage"), createCategory);
router.route("/:categoryId")
  .patch(upload.single("backgroundImage"), updateCategory)
  .delete(deleteCategory);

// Subcategory management
router.route("/subs").post(createSubCategory);
router.route("/subs/:subCategoryId")
  .patch(updateSubCategory)
  .delete(deleteSubCategory);

export default router;