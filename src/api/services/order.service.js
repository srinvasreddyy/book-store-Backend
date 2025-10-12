import { Cart } from "../models/cart.model.js";
import { Order } from "../models/order.model.js";
import { Discount } from "../models/discount.model.js";
import { Book } from "../models/book.model.js";
import { HANDLING_FEE, BASE_DELIVERY_FEE } from "../../constants.js";
import Razorpay from "razorpay";
import mongoose from "mongoose";
import { ApiError } from "../../utils/ApiError.js";

const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const initiateOrder = async (orderData, user, headers) => {
    const { couponCode, paymentMethod } = orderData;
    const userId = user._id;
    const idempotencyKey = headers['idempotency-key'];

    if (!paymentMethod) {
        throw new ApiError(400, "Payment method is required.");
    }

    if (idempotencyKey) {
        const existingOrder = await Order.findOne({ idempotencyKey });
        if (existingOrder) {
            return existingOrder;
        }
    }

    const cart = await Cart.findOne({ user: userId }).populate("items.book");
    if (!cart || cart.items.length === 0) {
        throw new ApiError(400, "Your cart is empty");
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        // --- 0. Pre-order Stock Validation ---
        for (const item of cart.items) {
            const book = await Book.findById(item.book._id).session(session);
            if (book.stock < item.quantity) {
                throw new ApiError(400, `The item '${item.book.title}' is out of stock or the requested quantity is not available.`);
            }
        }


        // --- 1. Calculate Pricing ---
        let subtotal = 0;
        const orderedItems = cart.items.map(item => {
            subtotal += item.book.price * item.quantity;
            return {
                book: item.book._id,
                quantity: item.quantity,
                priceAtPurchase: item.book.price,
                uploadedBy: item.book.uploadedBy,
            };
        });

        let discountAmount = 0;
        let appliedDiscount = null;
        let deliveryFee = BASE_DELIVERY_FEE;

        if (couponCode) {
            const discount = await Discount.findOne({ couponCode: couponCode.toUpperCase() }).session(session);

            // Basic validation (full validation happens before payment)
            if (discount && discount.isActive && subtotal >= discount.minCartValue) {
                if (discount.type === 'PERCENTAGE') {
                    discountAmount = subtotal * (discount.value / 100);
                } else if (discount.type === 'FIXED_AMOUNT') {
                    discountAmount = discount.value;
                } else if (discount.type === 'FREE_DELIVERY') {
                    deliveryFee = 0;
                }
                appliedDiscount = discount._id;
            }
        }

        const totalAfterDiscount = Math.max(0, subtotal - discountAmount);
        const finalAmount = totalAfterDiscount + HANDLING_FEE + deliveryFee;

        // --- 2. Create Order in 'PENDING' state ---
        const order = new Order({
            user: userId,
            items: orderedItems,
            subtotal,
            discountAmount,
            handlingFee: HANDLING_FEE,
            deliveryFee,
            finalAmount,
            appliedDiscount,
            paymentMethod,
            paymentStatus: 'PENDING',
            idempotencyKey,
        });

        // --- 3. Handle Payment Method ---
        if (paymentMethod === 'CASH_ON_DELIVERY') {
            order.status = 'PROCESSING';
            order.paymentStatus = 'PENDING'; // Payment will be completed on delivery
            await order.save({ session });

            // Decrement stock for COD
            for (const item of orderedItems) {
                await Book.findByIdAndUpdate(item.book, { $inc: { stock: -item.quantity } }, { session });
            }

            // Clear cart for COD
            await Cart.findOneAndUpdate({ user: userId }, { $set: { items: [] } }, { session });

            await session.commitTransaction();

            return order;

        } else { // For all online methods, create a Razorpay order
            const options = {
                amount: Math.round(finalAmount * 100), // Amount in the smallest currency unit
                currency: "INR",
                receipt: order._id.toString(),
            };

            const razorpayOrder = await instance.orders.create(options);
            if (!razorpayOrder) {
                throw new ApiError(500, "Failed to create Razorpay order.");
            }

            order.razorpayOrderId = razorpayOrder.id;
            await order.save({ session });

            await session.commitTransaction();

            return {
                order,
                razorpayOrder,
            };
        }
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

export default {
    initiateOrder,
};