import { Router } from "express";
import {
    createAnnouncement,
    getActiveAnnouncements,
    getAllAnnouncements,
    updateAnnouncement,
    deleteAnnouncement,
} from "../controllers/announcement.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyAdmin } from "../middlewares/rbac.middleware.js";

const router = Router();

// Public route
router.route("/").get(getActiveAnnouncements);

// Admin routes
router.route("/all").get(verifyJWT, verifyAdmin, getAllAnnouncements);
router.route("/").post(verifyJWT, verifyAdmin, createAnnouncement);
router.route("/:announcementId").patch(verifyJWT, verifyAdmin, updateAnnouncement);
router.route("/:announcementId").delete(verifyJWT, verifyAdmin, deleteAnnouncement);

export default router;