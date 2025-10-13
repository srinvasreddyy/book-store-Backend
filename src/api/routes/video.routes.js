import { Router } from "express";
import {
  uploadVideo,
  getVideosByBook,
  getVideoById,
  updateVideoDetails,
  deleteVideo,
} from "../controllers/video.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyAdmin } from "../middlewares/rbac.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// Public routes
router.route("/book/:bookId").get(getVideosByBook);
router.route("/:videoId").get(getVideoById);

// Admin routes
router
  .route("/")
  .post(verifyJWT, verifyAdmin, upload.single("videoFile"), uploadVideo);

router
  .route("/:videoId")
  .patch(verifyJWT, verifyAdmin, updateVideoDetails)
  .delete(verifyJWT, verifyAdmin, deleteVideo);

export default router;
