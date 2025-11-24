import { Router } from "express";
import {
    createFreeContent,
    getFreeContent,
    updateFreeContent,
    deleteFreeContent
} from "../controllers/freeContent.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyAdmin } from "../middlewares/rbac.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// Public route
router.route("/").get(getFreeContent);

// Admin routes
router.use(verifyJWT, verifyAdmin);

router.route("/")
    .post(
        upload.fields([
            { name: "pdf", maxCount: 1 },
            { name: "coverImage", maxCount: 1 }
        ]),
        createFreeContent
    );

router.route("/:contentId")
    .patch(
        upload.fields([
            { name: "pdf", maxCount: 1 },
            { name: "coverImage", maxCount: 1 }
        ]),
        updateFreeContent
    )
    .delete(deleteFreeContent);

export default router;