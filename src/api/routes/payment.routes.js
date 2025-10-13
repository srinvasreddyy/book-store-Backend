import { Router } from "express";
import { verifyRazorpayPayment, getRawBody } from "../controllers/payment.controller.js";
import express from 'express';

const router = Router();

// This is a public webhook and should not have JWT verification.
// It uses a special middleware to capture the raw body before it's parsed as JSON.
router.route("/verify/razorpay").post(express.raw({type: 'application/json'}), verifyRazorpayPayment);

export default router;