import { Router } from "express";
import {
  createCategory,
  getGlobalCategories,
  getAllCategories,
  getTopCategories,
  getSelectableCategories,
  getAdminCategoriesWithBooks,
  updateCategory,
  deleteCategory,
} from "../controllers/category.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyAdmin } from "../middlewares/rbac.middleware.js";
import { upload } from "../middlewares/multer.middleware.js"; // Import upload

const router = Router();

// Public routes
router.route("/").get(getGlobalCategories); // Existing route for global categories
router.route("/all").get(getAllCategories); // New route for all categories
router.route("/top").get(getTopCategories); // New route for top categories

// Admin routes
router.use(verifyJWT, verifyAdmin);

router
  .route("/")
  .post(upload.single("backgroundImage"), createCategory); // Add middleware

router.route("/selectable").get(getSelectableCategories);
router.route("/my-books").get(getAdminCategoriesWithBooks);

router
  .route("/:categoryId")
  .patch(upload.single("backgroundImage"), updateCategory) // Add middleware
  .delete(deleteCategory);

export default router;