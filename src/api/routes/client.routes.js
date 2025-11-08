import { Router } from "express";
import {
  getClients,
  createClient,
  updateClient,
  deleteClient,
} from "../controllers/client.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyAdmin } from "../middlewares/rbac.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

// Public route
router.route("/").get(getClients);

// Admin routes
router.use(verifyJWT, verifyAdmin);

router.route("/").post(upload.single("image"), createClient);
router
  .route("/:clientId")
  .patch(upload.single("image"), updateClient)
  .delete(deleteClient);

export default router;