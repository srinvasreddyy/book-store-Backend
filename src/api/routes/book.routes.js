import { Router } from "express";
import {
    createBook,
    getAllBooks,
    getBookById,
    updateBookDetails,
    deleteBook,
} from "../controllers/book.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyAdmin } from "../middlewares/rbac.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// Public routes
router.route("/").get(getAllBooks);
router.route("/:bookId").get(getBookById);

// Admin routes
router
    .route("/")
    .post(verifyJWT, verifyAdmin, upload.single("coverImage"), createBook);

router
    .route("/:bookId")
    .patch(verifyJWT, verifyAdmin, updateBookDetails)
    .delete(verifyJWT, verifyAdmin, deleteBook);

export default router;