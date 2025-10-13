import { Router } from "express";
import {
  createCategory,
  getAllCategories,
  getSelectableCategories,
  getAdminCategoriesWithBooks,
  updateCategory,
  deleteCategory,
} from "../controllers/category.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyAdmin } from "../middlewares/rbac.middleware.js";

const router = Router();

// Public route (shows only global categories)
router.route("/").get(getAllCategories);

// Admin routes
router.use(verifyJWT, verifyAdmin);

router.route("/").post(createCategory); // Creates a category owned by the admin
router.route("/selectable").get(getSelectableCategories);
router.route("/my-books").get(getAdminCategoriesWithBooks);

router.route("/:categoryId").patch(updateCategory);
router.route("/:categoryId").delete(deleteCategory);

export default router;
