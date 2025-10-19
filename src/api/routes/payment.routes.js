import { Router } from "express";
import { verifyRazorpayPayment, getRazorpayKey } from "../controllers/payment.controller.js";

const router = Router();

// Get Razorpay key for frontend
router.route("/key").get(getRazorpayKey);

// This is a public webhook and should not have JWT verification.
// The raw body is captured by a 'verify' function in the global express.json() middleware in app.js
router.route("/verify/razorpay").post(verifyRazorpayPayment);

export default router;