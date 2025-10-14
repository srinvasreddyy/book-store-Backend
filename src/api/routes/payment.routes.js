import { Router } from "express";
import { verifyRazorpayPayment } from "../controllers/payment.controller.js";

const router = Router();

// This is a public webhook and should not have JWT verification.
// The raw body is captured by a 'verify' function in the global express.json() middleware in app.js
router.route("/verify/razorpay").post(verifyRazorpayPayment);

export default router;