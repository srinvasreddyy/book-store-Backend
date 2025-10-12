import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { Order } from "../models/order.model.js";
import { Cart } from "../models/cart.model.js";
import { Book } from "../models/book.model.js";
import crypto from "crypto";
import mongoose from "mongoose";
import logger from "../../utils/logger.js";

const verifyRazorpayPayment = asyncHandler(async (req, res) => {
    // --- Defensive Payload Validation ---
    const paymentEntity = req.body?.payload?.payment?.entity;
    if (!paymentEntity) {
        throw new ApiError(400, "Malformed webhook payload. Payment entity is missing.");
    }
    
    const { order_id: razorpay_order_id, id: razorpay_payment_id } = paymentEntity;
    const razorpay_signature = req.headers['x-razorpay-signature'];

    if (!razorpay_order_id || typeof razorpay_order_id !== 'string' || razorpay_order_id.trim() === "") {
        throw new ApiError(400, "Razorpay Order ID is missing or invalid in webhook payload.");
    }
    if (!razorpay_payment_id || typeof razorpay_payment_id !== 'string' || razorpay_payment_id.trim() === "") {
        throw new ApiError(400, "Razorpay Payment ID is missing or invalid in webhook payload.");
    }
    if (!razorpay_signature || typeof razorpay_signature !== 'string' || razorpay_signature.trim() === "") {
        throw new ApiError(400, "x-razorpay-signature header is missing or invalid.");
    }
    // --- End Validation ---

    const body = JSON.stringify(req.body);

    const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest("hex");

    if (expectedSignature !== razorpay_signature) {
        logger.error(`Signature mismatch for order ${razorpay_order_id}. Expected: ${expectedSignature}, Got: ${razorpay_signature}`);
        await Order.findOneAndUpdate(
            { razorpayOrderId: razorpay_order_id },
            { paymentStatus: 'FAILED', status: 'FAILED' }
        );
        throw new ApiError(400, "Invalid signature. Payment verification failed.");
    }
    
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const order = await Order.findOne({ razorpayOrderId: razorpay_order_id }).session(session);

        if (!order) {
            logger.error(`Webhook for non-existent order received. Razorpay Order ID: ${razorpay_order_id}`);
            throw new ApiError(404, "Order not found for this payment.");
        }

        // Idempotency check: if order is already processed, just return success.
        if (order.paymentStatus === 'COMPLETED') {
            await session.abortTransaction();
            logger.info(`Received duplicate webhook for already completed order ${order._id}`);
            return res.status(200).json({ status: "ok" });
        }

        order.paymentStatus = 'COMPLETED';
        order.status = 'PROCESSING';
        order.razorpayPaymentId = razorpay_payment_id;
        order.razorpaySignature = razorpay_signature;
        await order.save({ session });
        
        // Decrement stock for each item in the order
        for (const item of order.items) {
            const book = await Book.findById(item.book).session(session);
            if (!book || book.stock < item.quantity) {
                throw new ApiError(500, `Stock inconsistency for book ${item.book} during order completion.`);
            }
            await Book.findByIdAndUpdate(item.book, { $inc: { stock: -item.quantity } }, { session });
        }

        // Clear the user's cart
        await Cart.findOneAndUpdate({ user: order.user }, { $set: { items: [] } }, { session });

        await session.commitTransaction();

        logger.info(`Successfully verified and processed payment for Order ID: ${order._id}`);
        return res.status(200).json({ status: "ok" });
        
    } catch (error) {
        await session.abortTransaction();
        logger.error("Payment verification transaction failed:", error);
        
        // Attempt to mark the order as failed if something went wrong
        await Order.findOneAndUpdate(
            { razorpayOrderId: razorpay_order_id },
            { paymentStatus: 'FAILED', status: 'FAILED' }
        );

        if (error instanceof ApiError) throw error;
        throw new ApiError(500, "An error occurred during payment verification.");
    } finally {
        session.endSession();
    }
});

export { verifyRazorpayPayment };