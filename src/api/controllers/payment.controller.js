import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { Order } from "../models/order.model.js";
import { Cart } from "../models/cart.model.js";
import { Book } from "../models/book.model.js";
import crypto from "crypto";
import mongoose from "mongoose";
import logger from "../../utils/logger.js";

const verifyRazorpayPayment = asyncHandler(async (req, res) => {
  const razorpay_order_id = req.body?.payload?.payment?.entity?.order_id;
  const razorpay_payment_id = req.body?.payload?.payment?.entity?.id;
  const razorpay_signature = req.headers["x-razorpay-signature"];
  const rawBody = req.rawBody; // Assuming rawBody is attached by a middleware

  logger.info({
    message: "Razorpay webhook received.",
    razorpay_order_id,
    razorpay_payment_id,
  });

  // --- Defensive Payload and Header Validation ---
  if (!rawBody) {
    logger.error("Raw body is missing for signature verification.");
    throw new ApiError(500, "Internal server error: Raw body not available.");
  }

  if (!razorpay_order_id) {
    throw new ApiError(400, "Razorpay Order ID is missing in webhook payload.");
  }
  if (!razorpay_payment_id) {
    throw new ApiError(400, "Razorpay Payment ID is missing in webhook payload.");
  }
  if (!razorpay_signature) {
    throw new ApiError(400, "x-razorpay-signature header is missing.");
  }
  // --- End Validation ---

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(rawBody)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    logger.error({
      message: "Razorpay signature mismatch.",
      razorpay_order_id,
      expected: expectedSignature,
      received: razorpay_signature,
    });
    // While the signature is invalid, we don't want to mark the order as failed yet,
    // as it could be a spoofed request. We just reject the webhook.
    throw new ApiError(400, "Invalid signature. Payment verification failed.");
  }

  logger.info({
    message: "Razorpay signature verified successfully.",
    razorpay_order_id,
  });

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const order = await Order.findOne({
      razorpayOrderId: razorpay_order_id,
    }).session(session);

    if (!order) {
      logger.warn({
        message: "Webhook for a non-existent order received.",
        razorpay_order_id,
      });
      // If the order doesn't exist in our DB, it's not our concern.
      // Acknowledge the webhook to prevent retries from Razorpay.
      await session.abortTransaction();
      return res.status(200).json({ status: "ok" });
    }

    // Idempotency check: if order is already processed, just return success.
    if (order.paymentStatus === "COMPLETED") {
      logger.info({
        message: "Duplicate webhook for an already completed order.",
        orderId: order._id,
        razorpay_order_id,
      });
      await session.abortTransaction();
      return res.status(200).json({ status: "ok" });
    }

    order.paymentStatus = "COMPLETED";
    order.status = "PROCESSING";
    order.razorpayPaymentId = razorpay_payment_id;
    order.razorpaySignature = razorpay_signature;
    await order.save({ session });

    // Decrement stock for each item in the order
    for (const item of order.items) {
      await Book.findByIdAndUpdate(
        item.book,
        { $inc: { stock: -item.quantity } },
        { session, runValidators: true },
      );
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
    return res.status(200).json({ status: "ok" });
  } catch (error) {
    await session.abortTransaction();
    logger.error({
        message: "Payment verification transaction failed.",
        error: error.message,
        razorpay_order_id,
        stack: error.stack,
    });

    // Best-effort attempt to mark the order as failed if something went wrong inside the transaction
    await Order.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      { paymentStatus: "FAILED", status: "FAILED" },
    );

    // We still throw an error to signal that the webhook processing failed.
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, "An internal error occurred during payment verification.");
  } finally {
    session.endSession();
  }
});

// We need to get the raw body for the signature verification, so we update app.js to attach it.
// This is a special middleware that should run *only* for the webhook route.
const getRawBody = (req, res, next) => {
    let data = '';
    req.on('data', chunk => {
        data += chunk;
    });
    req.on('end', () => {
        req.rawBody = data;
        next();
    });
};


export { verifyRazorpayPayment, getRawBody };