import { Router } from "express";
import { verifyRazorpayPayment } from "../controllers/payment.controller.js";

const router = Router();

// This is a public webhook and should not have JWT verification
router.route("/verify/razorpay").post(verifyRazorpayPayment);

export default router;
