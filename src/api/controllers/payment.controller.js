import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Order } from "../models/order.model.js";
import { Cart } from "../models/cart.model.js";
import { Book } from "../models/book.model.js";
import crypto from "crypto";
import mongoose from "mongoose";

const verifyRazorpayPayment = asyncHandler(async (req, res) => {
    const razorpay_order_id = req.body?.payload?.payment?.entity?.order_id;
    const razorpay_payment_id = req.body?.payload?.payment?.entity?.id;
    const razorpay_signature = req.headers['x-razorpay-signature'];

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        throw new ApiError(400, "Missing Razorpay payment details.");
    }

    const body = JSON.stringify(req.body);

    // --- Cryptographic Signature Verification ---
    const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest("hex");

    if (expectedSignature !== razorpay_signature) {
        // This is a critical security failure. The webhook is not from Razorpay.
        await Order.findOneAndUpdate(
            { razorpayOrderId: razorpay_order_id },
            { paymentStatus: 'FAILED', status: 'FAILED' }
        );
        throw new ApiError(400, "Invalid signature. Payment verification failed.");
    }
    
    // --- Signature is valid. Update the order. ---
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const order = await Order.findOneAndUpdate(
            { razorpayOrderId: razorpay_order_id },
            {
                paymentStatus: 'COMPLETED',
                status: 'PROCESSING',
                razorpayPaymentId: razorpay_payment_id,
                razorpaySignature: razorpay_signature
            },
            { new: true, session }
        );

        if (!order) {
            // This case might happen if the webhook arrives before the order is saved.
            // A more robust system would use a retry mechanism.
            throw new ApiError(404, "Order not found for this payment.");
        }

        // Decrement stock
        for (const item of order.items) {
            await Book.findByIdAndUpdate(item.book, { $inc: { stock: -item.quantity } }, { session });
        }


        // Clear the user's cart
        await Cart.findOneAndUpdate({ user: order.user }, { $set: { items: [] } }, { session });

        // Here you would also atomically update the discount usage counts if a coupon was used
        // This logic is omitted for brevity but is critical for production

        await session.commitTransaction();

        // Respond to Razorpay to acknowledge receipt of the webhook
        return res.status(200).json({ status: "ok" });
        
    } catch (error) {
        await session.abortTransaction();
        // Log the error for debugging
        console.error("Payment verification transaction failed:", error);
        // You might want to update the order to FAILED here as well
        throw new ApiError(500, "An error occurred during payment verification.");
    } finally {
        session.endSession();
    }
});

export { verifyRazorpayPayment };