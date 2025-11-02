import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Order } from "../models/order.model.js";
import { Cart } from "../models/cart.model.js";
import { Book } from "../models/book.model.js";
import crypto from "crypto";
import mongoose from "mongoose";
import logger from "../../utils/logger.js";
import orderService from "../services/order.service.js";
import { sendOrderConfirmationEmail } from "../../utils/mailer.js"; // Import mailer

// Get Razorpay key for frontend
const getRazorpayKey = asyncHandler(async (req, res) => {
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
  if (!razorpayKeyId) {
    throw new ApiError(500, "Razorpay key not configured");
  }

  return res.status(200).json({
    success: true,
    key: razorpayKeyId
  });
});

// Handle payment failure or cancellation from frontend
const handlePaymentFailure = asyncHandler(async (req, res) => {
  const { razorpayOrderId, reason } = req.body;

  if (!razorpayOrderId) {
    throw new ApiError(400, "Razorpay order ID is required");
  }

  logger.info({
    message: "Payment failure reported",
    razorpayOrderId,
    reason: reason || "Not specified",
    userId: req.user?._id
  });

  try {
    await orderService.markOrderAsFailed(razorpayOrderId);
    
    return res.status(200).json(
      new ApiResponse(200, null, "Order marked as failed")
    );
  } catch (error) {
    logger.error({
      message: "Failed to mark order as failed",
      razorpayOrderId,
      error: error.message
    });
    
    // Don't throw error to frontend, just log it
    return res.status(200).json(
      new ApiResponse(200, null, "Payment failure recorded")
    );
  }
});

// Feature Flag Check
const isRobustPaymentVerificationEnabled = process.env.ENABLE_ROBUST_PAYMENT_VERIFICATION === 'true';

const verifyRazorpayPayment = asyncHandler(async (req, res) => {
  // If the feature is not enabled, use the old logic or simply return an error.
  if (!isRobustPaymentVerificationEnabled) {
      logger.warn("Robust payment verification is disabled. Skipping execution.");
      // You can either call an old handler here or just return.
      // For this fix, we will assume the new logic is the only one.
      throw new ApiError(503, "Payment processing is temporarily unavailable.");
  }

  const razorpayWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!razorpayWebhookSecret) {
      logger.error("FATAL: RAZORPAY_WEBHOOK_SECRET is not configured. Aborting payment verification.");
      throw new ApiError(500, "Internal server configuration error.");
  }

  const razorpay_signature = req.headers["x-razorpay-signature"];
  const { rawBody } = req; // The raw body is attached in app.js

  // --- 1. Signature and Payload Validation ---
  if (!razorpay_signature) {
      logger.warn("Webhook received without x-razorpay-signature header.");
      throw new ApiError(400, "x-razorpay-signature header is missing.");
  }
  if (!rawBody) {
      logger.error("Raw body is missing for signature verification. Check express.json middleware.");
      throw new ApiError(500, "Internal server error: Raw body not available.");
  }

  try {
      const expectedSignature = crypto
          .createHmac("sha256", razorpayWebhookSecret)
          .update(rawBody.toString())
          .digest("hex");

      if (expectedSignature !== razorpay_signature) {
          logger.error({
              message: "Razorpay signature mismatch. Invalid webhook.",
              received: razorpay_signature,
              expected: expectedSignature,
          });
          throw new ApiError(400, "Invalid signature. Payment verification failed.");
      }
  } catch (error) {
      logger.error("Error during signature verification:", error);
      throw new ApiError(400, "Invalid signature format.");
  }
  
  // --- 2. Extract Data and Basic Payload Validation ---
  const { event, payload } = req.body;
  if (event !== 'payment.captured') {
      logger.info(`Received non-capture event '${event}'. Acknowledging and skipping.`);
      return res.status(200).json({ status: "ok", message: "Event ignored." });
  }

  const paymentEntity = payload?.payment?.entity;
  const razorpay_order_id = paymentEntity?.order_id;
  const razorpay_payment_id = paymentEntity?.id;

  if (!razorpay_order_id || !razorpay_payment_id) {
    logger.error({ message: "Webhook payload is missing order_id or payment_id.", payload });
    throw new ApiError(400, "Invalid webhook payload.");
  }
  
  logger.info({
    message: "Razorpay signature verified successfully. Processing payment.",
    razorpay_order_id,
    razorpay_payment_id,
  });

  // --- 3. Transactional Database Updates ---
  const session = await mongoose.startSession();
  session.startTransaction();
  
  let orderToEmail; // To store order ID for email

  try {
    const order = await Order.findOne({ razorpayOrderId: razorpay_order_id }).session(session);

    if (!order) {
      logger.warn({
        message: "Webhook for a non-existent or mismatched order received.",
        razorpay_order_id,
      });
      // Acknowledge to Razorpay to prevent retries for an order we don't have.
      await session.abortTransaction();
      return res.status(200).json({ status: "ok", message: "Order not found." });
    }

    // Idempotency Check: If already completed, do nothing further.
    if (order.paymentStatus === "COMPLETED") {
      logger.info({
        message: "Duplicate webhook for an already completed order.",
        orderId: order._id,
        razorpay_order_id,
      });
      await session.abortTransaction();
      return res.status(200).json({ status: "ok", message: "Already completed." });
    }

    // Update Order Status
    order.paymentStatus = "COMPLETED";
    order.status = "PROCESSING"; // Or "COMPLETED" if no shipping
    order.razorpayPaymentId = razorpay_payment_id;
    order.razorpaySignature = razorpay_signature;
    await order.save({ session });
    orderToEmail = order._id; // Save order ID for email

    // Decrement stock for each item
    for (const item of order.items) {
      const updatedBook = await Book.findByIdAndUpdate(
        item.book,
        { $inc: { stock: -item.quantity } },
        { session, new: true, runValidators: true },
      );
      if (!updatedBook || updatedBook.stock < 0) {
          throw new ApiError(409, `Stock update failed for book ${item.book}. Not enough stock.`);
      }
    }
    logger.info({ message: "Stock decremented successfully.", orderId: order._id });

    // Clear the user's cart
    await Cart.findOneAndUpdate(
      { user: order.user },
      { $set: { items: [] } },
      { session },
    );
    logger.info({ message: "User cart cleared successfully.", userId: order.user });

    await session.commitTransaction();

    logger.info({
      message: "Payment successfully verified and processed.",
      orderId: order._id,
    });
    
    // --- Send confirmation email (non-blocking) ---
    if (orderToEmail) {
      try {
        sendOrderConfirmationEmail(orderToEmail);
      } catch (emailError) {
        logger.warn(`Failed to send Razorpay order confirmation email for order ${orderToEmail}`, emailError);
      }
    }
    // --- End email send ---

    return res.status(200).json({ status: "ok", message: "Payment processed successfully." });

  } catch (error) {
    await session.abortTransaction();
    logger.error({
        message: "Payment verification transaction failed. Rolling back changes.",
        error: error.message,
        razorpay_order_id,
        stack: error.stack,
    });

    // Attempt to mark the order as failed as a best-effort
    await Order.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      { paymentStatus: "FAILED", status: "FAILED" },
    );

    if (error instanceof ApiError) throw error;
    throw new ApiError(500, "An internal error occurred during payment verification.");
  } finally {
    session.endSession();
  }
});

export { verifyRazorpayPayment, getRazorpayKey, handlePaymentFailure };