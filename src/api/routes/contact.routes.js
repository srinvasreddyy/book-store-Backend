import { Router } from "express";
import {
  getContact,
  getContactForAdmin,
  createContact,
  updateContact,
  deleteContact,
} from "../controllers/contact.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyAdmin } from "../middlewares/rbac.middleware.js";

const router = Router();

// Public route to get contact information
router.route("/").get(getContact);

// Admin routes
router.route("/admin").get(verifyJWT, verifyAdmin, getContactForAdmin);
router.route("/").post(verifyJWT, verifyAdmin, createContact);
router.route("/").patch(verifyJWT, verifyAdmin, updateContact);
router.route("/").delete(verifyJWT, verifyAdmin, deleteContact);

export default router;