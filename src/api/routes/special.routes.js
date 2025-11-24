import { Router } from "express";
import {
    createSpecial,
    getSpecials,
    updateSpecial,
    deleteSpecial
} from "../controllers/special.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyAdmin } from "../middlewares/rbac.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// Public route
router.route("/").get(getSpecials);

// Admin routes
router.use(verifyJWT, verifyAdmin);

router.route("/")
    .post(upload.array("images", 30), createSpecial);

router.route("/:specialId")
    .patch(upload.array("images", 30), updateSpecial)
    .delete(deleteSpecial);

export default router;