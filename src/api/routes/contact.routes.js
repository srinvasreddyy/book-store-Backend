import { Router } from "express";
import {
    getContact,
    createContact,
    updateContact,
    deleteContact
} from "../controllers/contact.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { verifyAdmin } from "../middlewares/rbac.middleware.js";

const router = Router();

// Public route to view contact info
router.route("/").get(getContact);

// Admin specific route (alias for getContact but typically used in admin panel)
router.route("/admin").get(verifyJWT, verifyAdmin, getContact);

// Protected routes
router.route("/")
    .post(verifyJWT, verifyAdmin, createContact)
    .patch(verifyJWT, verifyAdmin, updateContact)
    .delete(verifyJWT, verifyAdmin, deleteContact);

export default router;