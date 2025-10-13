import { Router } from "express";
import {
  getHomepageByAdminId,
  addCarouselImage,
  removeCarouselImage,
  addYoutubeVideo,
  removeYoutubeVideo,
  addShortVideo,
  removeShortVideo,
} from "../controllers/homepage.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyAdmin } from "../middlewares/rbac.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// --- Public Route ---
router.route("/:adminId").get(getHomepageByAdminId);

// --- Admin-Only Routes ---
router.use(verifyJWT, verifyAdmin);

router.route("/carousel").post(upload.single("image"), addCarouselImage);
router.route("/carousel/:itemId").delete(removeCarouselImage);

router.route("/youtube").post(addYoutubeVideo);
router.route("/youtube/:itemId").delete(removeYoutubeVideo);

router.route("/shorts").post(upload.single("video"), addShortVideo);
router.route("/shorts/:itemId").delete(removeShortVideo);

export default router;
